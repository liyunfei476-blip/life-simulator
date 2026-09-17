const ModelTransport = {
  active: new Set(),
  timeoutMs: 60000,
  idleMs: 20000,

  validateBase(value) {
    let url;
    try { url = new URL(value); } catch { throw new Error('接口地址必须是有效的 HTTPS 地址。'); }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        !host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') ||
        host.endsWith('.internal') || host.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      throw new Error('仅允许公网 HTTPS 域名，不支持本机、内网或 IP 地址。');
    }
    return url.href.replace(/\/+$/, '');
  },

  cancelAll() {
    for (const controller of this.active) controller.abort();
  },

  body(cfg, messages, maxTokens, stream) {
    const host = new URL(this.validateBase(cfg.baseURL)).hostname;
    const body = { model: cfg.model, messages, temperature: CONFIG.temperature,
      max_tokens: maxTokens || CONFIG.maxTokens, stream };
    if (host === 'api.deepseek.com' && /^deepseek-v4-/.test(cfg.model)) {
      body.thinking = { type: 'disabled' };
    } else if (host === 'dashscope.aliyuncs.com' && /^(qwen3|qwen-plus)/.test(cfg.model)) {
      body.enable_thinking = false;
    } else if (host === 'open.bigmodel.cn' && /^glm-5/.test(cfg.model)) {
      body.thinking = { type: 'disabled' };
    }
    return body;
  },

  async request(cfg, path, body, onDelta) {
    const base = this.validateBase(cfg.baseURL);
    if (typeof cfg.apiKey !== 'string' || !cfg.apiKey.trim()) throw new Error('请先填写自己的 API Key。');
    const controller = new AbortController();
    this.active.add(controller);
    let timeout = false;
    let idleTimer;
    let reader;
    const expire = () => { timeout = true; controller.abort(); };
    const timer = setTimeout(expire, this.timeoutMs);
    const touch = () => { clearTimeout(idleTimer); idleTimer = setTimeout(expire, this.idleMs); };
    try {
      touch();
      const response = await fetch(base + path, {
        method: body ? 'POST' : 'GET', signal: controller.signal,
        redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      if (!response.ok) {
        const tips = { 401: 'Key 无效或已失效', 403: '账号或模型访问受限',
          404: '接口地址或模型不存在', 429: '额度不足或请求过于频繁' };
        throw new Error('模型请求失败（HTTP ' + response.status + '）：' +
          (tips[response.status] || '服务暂不可用，请稍后重试'));
      }
      if (!body || !(response.headers.get('content-type') || '').includes('text/event-stream')) {
        const data = await response.json();
        if (!body) return data;
        if (data.error) throw new Error('模型服务返回错误，未结算本回合。');
        const choice = data.choices?.[0];
        this.checkFinish(choice?.finish_reason);
        const text = choice?.message?.content;
        if (typeof text !== 'string' || !text.trim()) throw new Error('模型没有返回正文，请更换模型或重试。');
        if (text.length > 65536) throw new Error('模型返回内容过长。');
        if (onDelta) onDelta(text, text);
        return text;
      }
      if (!response.body) throw new Error('当前浏览器不支持流式响应。');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let dataLines = [];
      let full = '';
      let finished = false;
      const dispatch = () => {
        if (!dataLines.length || finished) return;
        const payload = dataLines.join('\n').trim();
        dataLines = [];
        if (payload === '[DONE]') { finished = true; return; }
        if (!payload) return;
        let data;
        try { data = JSON.parse(payload); } catch { throw new Error('模型流式数据损坏，请重试。'); }
        if (data.error) throw new Error('模型服务返回错误，未结算本回合。');
        const choice = data.choices?.[0];
        this.checkFinish(choice?.finish_reason);
        const text = (choice?.delta || choice?.message)?.content;
        if (typeof text === 'string' && text) {
          full += text;
          if (full.length > 65536) throw new Error('模型返回内容过长。');
          if (onDelta) onDelta(text, full);
        }
      };
      const consume = (flush) => {
        const lines = buffer.split(/\r?\n/);
        buffer = flush ? '' : lines.pop();
        for (const line of lines) {
          if (finished) break;
          if (!line.trim()) dispatch();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }
        if (flush) dispatch();
      };
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) { buffer += decoder.decode(); consume(true); break; }
        touch();
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > 131072) throw new Error('模型流式数据异常。');
        consume(false);
      }
      if (!full.trim()) throw new Error('模型没有返回正文，思考内容不会作为游戏剧情。请更换模型或重试。');
      return full;
    } catch (error) {
      if (timeout) throw new Error('模型响应超时，本回合未消耗；请重试或更换模型。');
      if (controller.signal.aborted) throw new DOMException('已取消生成', 'AbortError');
      if (error instanceof TypeError) throw new Error('连接失败：请检查网络和接口的浏览器跨域（CORS）支持。');
      throw error;
    } finally {
      clearTimeout(timer);
      clearTimeout(idleTimer);
      if (reader) { reader.cancel().catch(() => {}); reader.releaseLock(); }
      this.active.delete(controller);
    }
  },

  checkFinish(reason) {
    if (reason === 'length') throw new Error('输出被截断，本回合未结算，请重试或更换模型。');
    if (reason === 'content_filter') throw new Error('该内容未通过模型审核，请换一种行动。');
  }
};
