// ===== AI 调用封装（OpenAI 兼容接口）=====

// 叙事正文与元数据 JSON 的分隔标记
const META_MARK = '###META###';

// 危险等级归一化
function normalizeDanger(v) {
  const allowed = ['none', 'low', 'medium', 'high', 'extreme'];
  const s = String(v || 'none').toLowerCase().trim();
  return allowed.includes(s) ? s : 'none';
}

// 包装流式回调：只把「分隔标记之前」的正文吐给 UI，元数据部分不显示
function makeNarrativeDeltaHandler(onDelta) {
  if (!onDelta) return null;
  let shown = 0;      // 已输出的正文长度
  let stopped = false;
  return (delta, full) => {
    if (stopped) return;
    const idx = full.indexOf(META_MARK);
    let suffix = 0;
    if (idx < 0) {
      for (let length = 1; length < META_MARK.length && length <= full.length; length++) {
        if (full.endsWith(META_MARK.slice(0, length))) suffix = length;
      }
    }
    const safeEnd = idx >= 0 ? idx : full.length - suffix;
    if (safeEnd > shown) {
      onDelta(full.slice(shown, safeEnd));
      shown = safeEnd;
    }
    if (idx >= 0) stopped = true;
  };
}

const AI = {
  // 构建请求体：显式关闭思考链，避免推理模型拖慢速度
  buildBody(modelCfg, messages, maxTokens, stream) {
    const body = {
      model: modelCfg.model,
      messages: messages,
      temperature: CONFIG.temperature,
      max_tokens: maxTokens || CONFIG.maxTokens,
      stream: !!stream
    };
    return JSON.stringify(ModelTransport.body(modelCfg, messages, body.max_tokens, body.stream));
  },

  async callChat(modelCfg, messages, maxTokens) {
    return ModelTransport.request(modelCfg, '/chat/completions',
      ModelTransport.body(modelCfg, messages, maxTokens, false));
  },

  async callChatStream(modelCfg, messages, onDelta, maxTokens) {
    return ModelTransport.request(modelCfg, '/chat/completions',
      ModelTransport.body(modelCfg, messages, maxTokens, true), onDelta);
  },

  async listModels(modelCfg) {
    const data = await ModelTransport.request(modelCfg, '/models');
    return (Array.isArray(data.data) ? data.data : [])
      .filter(m => m && typeof m.id === 'string' && m.id.length < 200)
      .map(m => m.id).slice(0, 500).sort();
  },

  // 从文本中提取 JSON 对象（容错）
  extractJSON(text) {
    if (!text) return null;
    // 直接解析
    try { return JSON.parse(text); } catch (e) { /* continue */ }
    // 提取 ```json ... ``` 块
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
      try { return JSON.parse(fence[1]); } catch (e) { /* continue */ }
    }
    // 提取第一个平衡的 {...} 块
    const start = text.indexOf('{');
    if (start >= 0) {
      let depth = 0, inStr = false, esc = false;
      for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (inStr) {
          if (esc) esc = false;
          else if (c === '\\') esc = true;
          else if (c === '"') inStr = false;
          continue;
        }
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) {
            try { return JSON.parse(text.slice(start, i + 1)); } catch (e) { return null; }
          }
        }
      }
    }
    return null;
  },

  // 分离「叙事正文」与「元数据 JSON」（以 ###META### 分隔，便于流式显示）
  splitNarrativeMeta(text) {
    const raw = String(text || '');
    const idx = raw.indexOf(META_MARK);
    const meta = this.extractJSON(idx < 0 ? raw : raw.slice(idx + META_MARK.length));
    const narrative = idx < 0 ? meta?.narrative : raw.slice(0, idx).trim();
    if (!meta || Array.isArray(meta) || typeof meta !== 'object' ||
        typeof narrative !== 'string' || !narrative.trim()) {
      throw new Error('模型没有返回完整剧情数据，本回合未结算，请重试。');
    }
    return { narrative: narrative.trim().slice(0, 6000), meta };
  },

  validateOptions(options) {
    if (!Array.isArray(options)) return [];
    return options.filter(o => o && typeof o.text === 'string' && o.text.trim())
      .slice(0, 4).map(o => ({ text: o.text.trim().slice(0, 200),
        risk: typeof o.risk === 'string' ? o.risk.slice(0, 160) : '' }));
  },

  // 构建系统提示词（尽量精简，降低首字延迟）
  buildSystemPrompt(state) {
    const w = getWorld(state.worldId);
    const p = state.player;
    const stage = w.stages[p.stageIndex];
    const next = w.stages[p.stageIndex + 1];
    const hpRatio = p.hp / p.maxHp;
    const hpWarn = hpRatio <= 0.25
      ? '⚠️ 主角重伤濒死，激烈行动极可能致命。'
      : (hpRatio <= 0.5 ? '主角有伤在身。' : '');

    return [
      '你是硬核文字冒险游戏的剧情引擎，生成沉浸、真实、有残酷感的剧情。玩家是穿越者。',
      `【世界】${w.name}：${w.description}`,
      `【当前】${stage.name}` + (next ? `（下一阶段：${next.name}）` : '（已至巅峰）'),
      `【状态】${buildStatusText(state)}`,
      `【行旅】${JSON.stringify(state.adventure || {})}`,
      '普通行动按30天结算，提问不推进时间。背包与制作由本地系统管理，不要虚构获得物品或目标奖励。',
      hpWarn,
      '【原则】第二人称叙事；这世界很危险，失败/重伤/被骗/被追杀是常态，不要一味给好运；',
      '严格按主角实力判定，越级鲁莽必有惨痛后果；不替玩家做决定；数值由系统管理，剧情里不写具体数值。'
    ].filter(Boolean).join('\n');
  },

  // 生成当前情境（事件 + 选项）；onDelta 用于流式输出叙事
  async generateScene(state, history, onDelta) {
    const messages = [
      { role: 'system', content: this.buildSystemPrompt(state) },
      ...history,
      {
        role: 'user',
        content: [
          '请生成主角当下遇到的「情境剧情」和「2~4 个选项」。',
          '情境应有变化：可能是机遇，也可能是危机、陷阱、强敌或绝境。',
          '',
          '严格按以下格式输出（先正文，再元数据，中间用标记分隔）：',
          '',
          '（这里写 150 字以内的情境剧情正文，纯文本）',
          META_MARK,
          '{"options":[{"text":"选项描述","risk":"风险或收益提示"}]}',
          '',
          '注意：标记之前只能是剧情正文，标记之后只能是 JSON，不要有其他内容。'
        ].join('\n')
      }
    ];
    const raw = await this.callChatStream(
      Storage.loadModelConfig(), messages,
      makeNarrativeDeltaHandler(onDelta), 900
    );
    const { narrative, meta } = this.splitNarrativeMeta(raw);
    const options = this.validateOptions(meta.options);
    if (!options.length) throw new Error('情境缺少可选行动，请重试。');
    return {
      narrative: narrative || '（AI 返回异常，请检查模型配置）',
      options: options
    };
  },

  // 生成玩家行动后的结果（isCustom = 玩家自由输入的行动）
  async generateResult(state, history, choiceText, isCustom, onDelta) {
    const w = getWorld(state.worldId);
    const attrNames = ['财富', '声望', '势力', '气运', '心情', '生命', w.mainAttr.label, ...w.customAttrs.map(a => a.label)];
    const extra = isCustom
      ? [
          '注意：这是玩家自由输入的行动，并非预设选项。请严格判断其合理性：',
          '- 若行动在当前情境与实力下合理可行，正常演绎结果（成功或失败都可能）。',
          '- 若行动明显超出主角实力、违背世界规则或不合情理，让它失败或产生严重反效果。',
          '- 若行动是自寻死路（自杀、跳崖、单挑远超自己的强敌、闯死地等），',
          '  必须演绎出真正的致命危险，并把 danger 判为 extreme。',
          '- 绝不因为玩家这么说就无条件让他成功。'
        ].join('\n')
      : '';

    const messages = [
      { role: 'system', content: this.buildSystemPrompt(state) },
      ...history,
      {
        role: 'user',
        content: [
          isCustom
            ? `玩家决定自行采取行动：「${choiceText}」。`
            : `玩家做出了选择：「${choiceText}」。`,
          extra,
          '请演绎这段剧情的结果，并直接给出主角接下来可采取的 2~4 个选项。',
          '允许出现失败、重伤、损失惨重乃至生死危机。',
          '',
          '严格按以下格式输出：',
          '',
          '（这里写 220 字以内的结果剧情正文，纯文本）',
          META_MARK,
          '{"effects":{"属性名":变化量},"danger":"none","combat":false,' +
            '"options":[{"text":"下一步选项","risk":"风险提示"}]}',
          '',
          `【effects】属性名限用：${attrNames.join('、')}。变化量 -40 ~ +40，可正可负，可省略。`,
          '【danger】本次行动主角面临的致命危险程度，按剧情如实判定：',
          '  "none"=安全无危险；"low"=轻微风险；"medium"=明显危险；',
          '  "high"=生死一线；"extreme"=九死一生／自寻死路。',
          '  重要：这只是危险程度，最终是否死亡由系统概率判定，你不要直接写主角死亡。',
          '  剧情写到「危机降临／身陷绝境」即可停笔，把生死留给系统裁决。',
          '【combat】若引发了战斗则为 true，否则 false。',
          '【options】承接上面剧情结尾的局面，给出主角下一步的 2~4 个可选行动。',
          '',
          '注意：标记之前只能是剧情正文，标记之后只能是 JSON。'
        ].filter(Boolean).join('\n')
      }
    ];
    const raw = await this.callChatStream(
      Storage.loadModelConfig(), messages,
      makeNarrativeDeltaHandler(onDelta), 1000
    );
    const { narrative, meta } = this.splitNarrativeMeta(raw);
    const options = this.validateOptions(meta.options);
    if (!['none', 'low', 'medium', 'high', 'extreme'].includes(meta.danger) ||
        typeof meta.combat !== 'boolean' || !meta.effects || Array.isArray(meta.effects) ||
        typeof meta.effects !== 'object') throw new Error('模型结算数据不完整，请重试。');
    const effects = Object.create(null);
    const totals = new Map();
    for (const [key, value] of Object.entries(meta.effects)) {
      if (!attrNames.includes(key) || typeof value !== 'number' || !Number.isFinite(value)) continue;
      const ref = locateAttr(state, key);
      if (!ref) continue;
      const group = (ref.obj === state.player ? 'player:' : 'custom:') + ref.key;
      const previous = totals.get(group) || 0;
      const next = Math.max(-40, Math.min(40, previous + Math.round(value)));
      effects[key] = next - previous;
      totals.set(group, next);
    }
    return { narrative, effects, danger: meta.danger, combat: meta.combat, options };
  },

  // 生死裁决叙事：由引擎先掷骰，再让 AI 按结果续写
  async narrateFate(state, history, fate, onDelta) {
    const desc = {
      death: '主角在这场危机中丧命。请写出他生命终结的最后时刻，悲壮而有分量。',
      survive: '主角侥幸生还，但付出了惨重代价（重伤、残缺、失去某些东西）。请写出他如何在鬼门关前挣回一命。',
      twist: '出现了意料之外的转折：或被神秘之人救下，或濒死中激发潜能／血脉／奇物，或敌人因故放手。请写出这个合理而惊险的转折。'
    }[fate] || '请续写这场危机的结果。';

    const messages = [
      { role: 'system', content: this.buildSystemPrompt(state) },
      ...history,
      {
        role: 'user',
        content: [
          '系统已裁定这场生死危机的结果：',
          desc,
          '',
          '请直接输出 120 字以内的纯文本剧情，不要输出 JSON，不要任何格式标记。'
        ].join('\n')
      }
    ];
    return await this.callChatStream(Storage.loadModelConfig(), messages, onDelta, 500);
  },

  // 回答玩家的自由提问（纯信息查询，不推进剧情、不改属性）
  async answerQuestion(state, history, question, onDelta) {
    const messages = [
      { role: 'system', content: this.buildSystemPrompt(state) },
      ...history,
      {
        role: 'user',
        content: [
          `玩家向你提问：「${question}」`,
          '',
          '请以「旁白／世界意识」的身份直接回答。可以是：解释世界观设定、说明当前处境、',
          '介绍某个人物或事物、给出建议、回顾已发生的经历等。',
          '',
          '要求：',
          '1. 只回答问题，不要推进剧情，不要产生新事件，不要替玩家行动。',
          '2. 回答简洁（150 字以内），符合世界设定与主角当前认知范围。',
          '3. 若问题涉及主角尚不可能知道的信息，可以含糊其辞或表示不知。',
          '4. 直接输出纯文本，不要 JSON，不要格式标记。'
        ].join('\n')
      }
    ];
    const raw = await this.callChatStream(Storage.loadModelConfig(), messages, onDelta, 500);
    return String(raw || '').trim() || '（无法回答）';
  }
};
