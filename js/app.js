// ===== 主循环与 UI 交互 =====
const G = {
  state: null,
  history: [],
  busy: false,
  slot: null,
  skipTyping: false,
  pendingOptions: [],
  epoch: 0,
  cleanup: null,
  retry: null
};

async function runGeneration(label, task, commit, retry, choice) {
  if (G.busy || !G.state || G.state.status !== 'playing') return;
  const epoch = ++G.epoch;
  G.busy = true;
  G.retry = retry;
  $('generation-recovery').classList.add('hidden');
  const choiceEl = choice ? appendInstant(choice, 'choice') : null;
  const thinking = showThinking(label);
  let block = null;
  const started = Date.now();
  const initialState = G.state;
  const initialHistoryLength = G.history.length;
  const timer = setInterval(() => {
    if (G.epoch === epoch) $('input-hint').textContent =
      '正在生成 · ' + Math.floor((Date.now() - started) / 1000) + ' 秒 · 可取消，失败不消耗回合';
  }, 1000);
  G.cleanup = () => {
    clearInterval(timer);
    removeEl(thinking);
    removeEl(choiceEl);
    if (block) removeEl(block.el);
  };
  setInputEnabled(false);
  try {
    const result = await task(chunk => {
      if (G.epoch !== epoch) return;
      if (!block) { removeEl(thinking); block = createStreamBlock('narrative'); }
      block.write(chunk);
    });
    if (G.epoch !== epoch) return;
    removeEl(thinking);
    if (block) block.done(result.narrative);
    else appendInstant(result.narrative, 'narrative');
    commit(result);
    G.cleanup = null;
    G.retry = null;
    trimHistory();
  } catch (error) {
    if (G.epoch !== epoch) return;
    if (G.state !== initialState || G.history.length !== initialHistoryLength) {
      G.cleanup = null;
      G.retry = null;
      JourneyUI.toast('行动已经结算，显示暂时异常；请保存后重新进入，勿重复执行。');
    } else {
      G.cleanup?.();
      G.cleanup = null;
      $('generation-error').textContent = error.message + ' 当前进度保持不变。';
      $('generation-recovery').classList.remove('hidden');
    }
  } finally {
    clearInterval(timer);
    if (G.epoch === epoch) {
      G.busy = false;
      renderOptions(G.pendingOptions);
      setInputEnabled(G.state?.status === 'playing');
      if (!G.retry) onSaveGame(true);
    }
  }
}

function cancelGeneration(showMessage = true) {
  ++G.epoch;
  ModelTransport.cancelAll();
  G.cleanup?.();
  G.cleanup = null;
  G.busy = false;
  if (G.state) {
    renderOptions(G.pendingOptions);
    setInputEnabled(G.state.status === 'playing');
    if (showMessage) {
      $('generation-error').textContent = '已取消，本回合未消耗。';
      $('generation-recovery').classList.remove('hidden');
    }
  }
}

const $ = (id) => document.getElementById(id);

// ===== 工具 =====
function hasAIConfig() {
  const cfg = Storage.loadModelConfig();
  return !!(cfg && cfg.apiKey && cfg.baseURL && cfg.model);
}

function currentWorld() {
  return G.state ? getWorld(G.state.worldId) : null;
}

// 是否已滚到接近底部（用于智能自动滚动）
function isNearBottom(el) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}

function scrollToBottom() {
  const area = $('story-area');
  area.scrollTop = area.scrollHeight;
}

// 快速打字机（仅用于本地短文本，速度已大幅提升）
function typeText(text, el) {
  return new Promise((resolve) => {
    G.skipTyping = false;
    const area = $('story-area');
    let i = 0;
    el.textContent = '';
    const CHUNK = 3;   // 每帧输出 3 个字，快约 3 倍
    const step = () => {
      if (G.skipTyping || i >= text.length) {
        el.textContent = text;
        scrollToBottom();
        resolve();
        return;
      }
      const stick = isNearBottom(area);
      el.textContent += text.slice(i, i + CHUNK);
      i += CHUNK;
      if (stick) scrollToBottom();
      setTimeout(step, 12);
    };
    step();
  });
}

// 追加一条剧情（打字机）
function appendNarrative(text, cls) {
  const area = $('story-area');
  const div = document.createElement('div');
  div.className = 'msg ' + (cls || '');
  area.appendChild(div);
  scrollToBottom();
  return typeText(text, div);
}

// 立即追加（无动画），返回元素
function appendInstant(text, cls) {
  const area = $('story-area');
  const div = document.createElement('div');
  div.className = 'msg ' + (cls || '');
  div.textContent = text;
  area.appendChild(div);
  while (area.children.length > 240) area.firstElementChild.remove();
  scrollToBottom();
  return div;
}

// 创建一个用于流式写入的消息块，返回 { el, write, done }
function createStreamBlock(cls) {
  const area = $('story-area');
  const div = document.createElement('div');
  div.className = 'msg streaming ' + (cls || '');
  area.appendChild(div);
  scrollToBottom();
  let pending = '';
  let frame = null;
  const flush = () => {
    frame = null;
    if (!div.isConnected) { pending = ''; return; }
    const stick = isNearBottom(area);
    div.textContent += pending;
    pending = '';
    if (stick) scrollToBottom();
  };
  return {
    el: div,
    write(chunk) {
      pending += chunk;
      if (frame === null) frame = requestAnimationFrame(flush);
    },
    done(finalText) {
      const stick = isNearBottom(area);
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      div.textContent = typeof finalText === 'string' ? finalText : div.textContent + pending;
      pending = '';
      div.classList.remove('streaming');
      if (stick) scrollToBottom();
    }
  };
}

// 显示"正在思考"指示
function showThinking(label) {
  const area = $('story-area');
  const div = document.createElement('div');
  div.className = 'msg thinking';
  div.innerHTML = '<span class="dots"><i></i><i></i><i></i></span> ' + (label || '命运正在编织……');
  area.appendChild(div);
  scrollToBottom();
  return div;
}

function removeEl(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// ===== 初始化 =====
function init() {
  fillPresetSelect();
  bindEvents();
  renderWorldList();
  fillSettingsForm(Storage.loadModelConfig());
  refreshSavesList();
  showFirstRunHint();
  JourneyUI.init();
}

// 首次进入引导：让新玩家知道需要配置自己的 API Key
function showFirstRunHint() {
  if (hasAIConfig()) {
    const cfg = Storage.loadModelConfig();
    $('start-tip').textContent = '✅ 已配置 ' + (cfg.name || '模型') + '（' + cfg.model + '），可直接开始。';
    return;
  }
  $('start-tip').textContent = '可直接离线试玩；自由剧情与提问需要在「模型设置」填入你自己的 Key。Key 仅在本次页面会话中使用，并发送至所选模型服务商，不包含在分享文件中。';
}

function fillPresetSelect() {
  const sel = $('preset-select');
  sel.innerHTML = '';
  CONFIG.modelPresets.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
}

function bindEvents() {
  $('btn-start').addEventListener('click', onStart);
  $('btn-back').addEventListener('click', onBackToStart);
  $('btn-save').addEventListener('click', () => onSaveGame(false));
  $('btn-game-settings').addEventListener('click', openSettings);
  $('btn-cancel-generation').addEventListener('click', () => cancelGeneration());
  $('btn-retry-generation').addEventListener('click', () => { if (!G.busy) G.retry?.(); });
  $('btn-recovery-settings').addEventListener('click', openSettings);
  $('btn-toggle-status').addEventListener('click', () => {
    $('status-panel').classList.toggle('open');
  });
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-saves').addEventListener('click', openSaves);
  $('btn-settings-save').addEventListener('click', saveSettings);
  $('btn-settings-cancel').addEventListener('click', closeSettings);
  $('btn-saves-cancel').addEventListener('click', closeSaves);
  $('btn-talent-confirm').addEventListener('click', onTalentConfirm);
  $('btn-ending-restart').addEventListener('click', onBackToStart);
  $('btn-ending-close').addEventListener('click', closeEnding);
  $('preset-select').addEventListener('change', onPresetChange);
  $('btn-fetch-models').addEventListener('click', onFetchModels);
  $('model-select').addEventListener('change', onModelSelectChange);

  // 自由输入
  $('btn-act').addEventListener('click', onCustomAction);
  $('btn-ask').addEventListener('click', onAsk);
  $('input-action').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) onAsk();
      else onCustomAction();
    }
  });

  // 点击剧情区跳过打字
  $('story-area').addEventListener('click', () => { G.skipTyping = true; });
}

// ===== 世界选择 =====
function renderWorldList() {
  const list = $('world-list');
  list.innerHTML = '';
  WORLDS.forEach((w, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'world-card';
    card.style.setProperty('--atlas-pos', JourneyUI.position(i));
    card.dataset.id = w.id;
    card.style.setProperty('--wc', w.themeColor);
    card.innerHTML =
      '<div class="wc-emoji">' + w.emoji + '</div>' +
      '<div class="wc-name">' + w.name + '</div>' +
      '<div class="wc-desc">' + w.description + '</div>';
    card.addEventListener('click', () => selectWorld(w.id));
    list.appendChild(card);
    if (i === 0) selectWorld(w.id);
  });
}

let selectedWorldId = WORLDS[0].id;
function selectWorld(id) {
  selectedWorldId = id;
  document.querySelectorAll('.world-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });
  const w = getWorld(id);
  document.documentElement.style.setProperty('--theme', w.themeColor);
}

// ===== 开始 / 返回 =====
function onStart() {
  const name = ($('input-name').value || '').trim() || '无名氏';
  const world = getWorld(selectedWorldId);

  if (!hasAIConfig()) {
    $('start-tip').textContent = '⚠️ 尚未配置 AI 模型，将进入「本地兜底模式」（剧情有限）。点击「模型设置」填入 API Key 可获得完整体验。';
  } else {
    $('start-tip').textContent = '';
  }

  // 分步流程：穿越过场 → 天赋觉醒 → 进入游戏
  playTransition(world, name);
}

// ===== 第一步：穿越过场 =====
function playTransition(world, name) {
  $('screen-start').classList.add('hidden');
  const scr = $('screen-transition');
  scr.classList.remove('hidden');
  document.documentElement.style.setProperty('--theme', world.themeColor);

  const lines = [
    '公元 2026 年，夜。',
    '你眼前的世界忽然开始扭曲……',
    '一道漩涡撕开了时空的帷幕——',
    '「' + world.name + '」',
    world.description,
    '你的意识，坠入了无尽的黑暗……'
  ];

  const box = $('transition-text');
  box.innerHTML = '';
  lines.forEach((t, i) => {
    const span = document.createElement('span');
    span.className = 'tline';
    span.textContent = t;
    span.style.animationDelay = (i * .45) + 's';
    box.appendChild(span);
  });

  let finished = false;
  const totalMs = lines.length * 450 + 800;
  const timer = setTimeout(finish, totalMs);

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    scr.classList.add('hidden');
    scr.removeEventListener('click', finish);
    showAwakening(world, name);
  }
  scr.addEventListener('click', finish);
}

// ===== 第二步：天赋觉醒 =====
let awakeningState = { world: null, name: '', talent: null };

function showAwakening(world, name) {
  awakeningState = { world, name, talent: null };

  const scr = $('screen-awakening');
  scr.classList.remove('hidden');
  scr.style.setProperty('--world-glow', world.bgGlow || 'rgba(138, 108, 255, .14)');
  $('awaken-ornament').textContent = world.ornament || '';
  $('btn-talent-confirm').disabled = true;

  // 从天赋池随机抽 3 个
  const pool = [...world.talents];
  const picks = [];
  while (picks.length < Math.min(3, pool.length)) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }

  const list = $('talent-list');
  list.innerHTML = '';
  picks.forEach(t => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'talent-card';
    card.setAttribute('aria-pressed', 'false');
    const effText = Object.entries(t.effects).map(([k, v]) => k + ' ' + (v >= 0 ? '+' : '') + v).join('，');
    card.innerHTML =
      '<div class="talent-name">' + t.name + '</div>' +
      '<div class="talent-desc">' + t.desc + '</div>' +
      '<div class="talent-effects">' + effText + '</div>';
    card.addEventListener('click', () => {
      awakeningState.talent = t;
      list.querySelectorAll('.talent-card').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); });
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      $('btn-talent-confirm').disabled = false;
    });
    list.appendChild(card);
  });
}

// ===== 第三步：确认天赋，进入游戏 =====
function onTalentConfirm() {
  const { world, name, talent } = awakeningState;
  if (!talent) return;
  $('screen-awakening').classList.add('hidden');
  startNewGame(world.id, name, null, talent);
}

// ===== 游戏初始化 =====
function startNewGame(worldId, name, loaded, talent) {
  cancelGeneration(false);
  G.pendingOptions = [];
  G.retry = null;
  $('generation-recovery').classList.add('hidden');
  $('status-panel').classList.remove('open');
  if (loaded) {
    G.state = loaded.state;
    G.history = loaded.history;
    G.slot = loaded.slot;
  } else {
    G.state = createInitialState(worldId, name, talent);
    G.history = [];
    G.slot = Storage.newSlot();
  }

  const w = getWorld(G.state.worldId);
  document.documentElement.style.setProperty('--theme', w.themeColor);

  // 世界差异化 UI
  const gameScr = $('screen-game');
  gameScr.dataset.world = w.id;
  gameScr.style.setProperty('--world-glow', w.bgGlow || 'rgba(138, 108, 255, .12)');
  $('status-panel').dataset.motif = w.panelMotif || '✦';

  $('screen-home').classList.add('hidden');
  $('screen-start').classList.add('hidden');
  $('screen-awakening').classList.add('hidden');
  $('screen-transition').classList.add('hidden');
  $('screen-game').classList.remove('hidden');
  JourneyUI.togglePanel(false);
  $('game-title').textContent = w.name;

  const area = $('story-area');
  area.innerHTML = '';

  renderStatus();
  startOpening(loaded, talent);
}

async function startOpening(loaded, talent) {
  const w = currentWorld();
  const p = G.state.player;
  if (loaded) {
    const messages = loaded.messages.length ? loaded.messages :
      loaded.history.map(m => ({ text: m.content, cls: m.role === 'user' ? 'choice' : 'narrative' }));
    messages.forEach(m => appendInstant(m.text, m.cls));
    G.pendingOptions = loaded.options;
    if (G.state.status === 'ended') {
      G.pendingOptions = [];
      endGame(G.state.ending || '旅途已结束。', G.state.endingType);
    } else {
      renderOptions(G.pendingOptions);
      setInputEnabled(true);
    }
    return;
  }
  const opening = '你在「' + w.name + '」醒来。' + w.description +
    '\n你的新人生从 ' + p.age + ' 岁开始。' + (talent ? '\n天赋「' + talent.name + '」：' + talent.desc : '');
  appendInstant(opening, 'opening');
  const theme = Adventure.theme(w.id);
  const welcome = '你暂住在' + theme.home + '。这里是休整与出发的地方。可以先探索附近、研习成长，或做些营生补充行囊。';
  appendInstant(welcome, 'narrative');
  G.history.push({ role: 'assistant', content: opening + '\n' + welcome });
  G.pendingOptions = [];
  renderOptions([]);
  setInputEnabled(true);
  onSaveGame(true);
}

function onBackToStart() {
  cancelGeneration(false);
  onSaveGame(true);
  closeEnding();
  G.state = null;
  G.history = [];
  G.busy = false;
  G.slot = null;
  $('screen-game').classList.add('hidden');
  $('screen-awakening').classList.add('hidden');
  $('screen-transition').classList.add('hidden');
  JourneyUI.home();
  refreshSavesList();
}

// ===== 主循环 =====
async function playTurn() {
  return runGeneration('正在生成开场……', async write => {
    if (hasAIConfig()) return AI.generateScene(G.state, G.history.slice(-CONFIG.MAX_HISTORY), write);
    const event = pickLocalEvent();
    return { narrative: event.text, options: event.options };
  }, scene => {
    G.pendingOptions = scene.options;
    G.history.push({ role: 'assistant', content: '情境：' + scene.narrative });
  }, playTurn);
}

function renderOptions(options) {
  const area = $('options-area');
  area.innerHTML = '';
  options.forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = o.text;
    if (o.risk) {
      const span = document.createElement('span');
      span.className = 'risk';
      span.textContent = o.risk;
      btn.appendChild(span);
    }
    if (G.state?.adventure?.pending && o.actionId) {
      btn.disabled = G.busy || !!Adventure.available(G.state, o.actionId);
      btn.addEventListener('click', () => JourneyUI.act(o.actionId));
    } else {
      btn.addEventListener('click', () => onChoose(o.text, false));
    }
    area.appendChild(btn);
  });
}

// ===== 自由输入：自定义行动 / 向 AI 提问 =====
function setInputEnabled(on) {
  const input = $('input-action');
  if (!input) return;
  input.disabled = !on;
  $('btn-act').disabled = !on;
  $('btn-ask').disabled = !on;
  $('btn-save').disabled = G.busy;
  $('btn-game-settings').disabled = G.busy;
  $('btn-cancel-generation').classList.toggle('hidden', !G.busy);
  document.querySelectorAll('.option-btn').forEach((button, index) => {
    const id = G.pendingOptions[index]?.actionId;
    button.disabled = !on || G.busy || (id ? !!Adventure.available(G.state, id) : false);
  });
  $('input-hint').textContent = G.state?.status === 'ended' ? '旅途已结束，可查看回顾或重新开始。' :
    (on ? '即时玩法无需等待 · Enter 自由行动 · Ctrl/⌘ + Enter 提问'
      : '正在生成，可取消；网络失败不消耗回合。');
  JourneyUI.render();
}

// 自定义行动：会真正推进剧情、影响属性
function onCustomAction() {
  const input = $('input-action');
  const text = (input.value || '').trim();
  if (!text || G.busy) return;
  onChoose(text, true);
}

// 提问：只询问信息，不推进回合、不改属性
async function onAsk() {
  const text = $('input-action').value.trim();
  if (!text || G.busy || !G.state || G.state.status !== 'playing') return;
  const ask = () => runGeneration('正在回答……', async write => {
    if (!hasAIConfig()) throw new Error('自由提问需要先配置 AI 模型。');
    return { narrative: await AI.answerQuestion(G.state, G.history.slice(-CONFIG.MAX_HISTORY), text, write) };
  }, result => {
    $('input-action').value = '';
    G.history.push({ role: 'user', content: '我问：' + text },
      { role: 'assistant', content: result.narrative });
  }, ask, '你问：' + text);
  return ask();
}

function clearOptions() {
  $('options-area').innerHTML = '';
}

function trimHistory() {
  if (G.history.length > CONFIG.MAX_HISTORY) {
    G.history = G.history.slice(-CONFIG.MAX_HISTORY);
  }
}

async function onChoose(text, isCustom) {
  if (typeof text !== 'string' || !text.trim()) return;
  text = text.trim().slice(0, 200);
  return runGeneration('结果正在展开……', async write => {
    if (hasAIConfig()) return AI.generateResult(G.state, G.history.slice(-CONFIG.MAX_HISTORY), text, isCustom, write);
    if (isCustom) throw new Error('离线试玩仅支持预设选项，自由行动请先配置模型。');
    const event = pickLocalEvent();
    return { narrative: '你选择了「' + text + '」。\n\n' + event.text,
      effects: localResolve(G.state, text), danger: localGuessDanger(text),
      combat: false, options: event.options };
  }, result => {
    const settled = settleAction(G.state, result, text);
    settled.state.adventure.pending = null;
    G.state = settled.state;
    $('input-action').value = '';
    G.history.push({ role: 'user', content: '我的行动：' + text },
      { role: 'assistant', content: result.narrative + '\n系统结算：' + settled.messages.join('；') });
    for (const message of settled.messages) appendInstant(message, 'effects');
    G.pendingOptions = G.state.status === 'ended' || settled.fate !== 'safe' ? [] : result.options;
    renderStatus();
    if (G.state.status === 'ended') endGame(G.state.ending, G.state.endingType);
  }, () => onChoose(text, isCustom), '你的行动：' + text);
}

// ===== 状态渲染 =====
function renderStatus() {
  const p = G.state.player;
  const w = currentWorld();
  const stage = w.stages[p.stageIndex];
  const nextStage = w.stages[p.stageIndex + 1];
  const panel = $('status-panel');
  panel.innerHTML = '';

  // 顶部：身份卡
  const head = document.createElement('div');
  head.className = 'sp-head';
  head.innerHTML =
    '<div class="sp-name"></div>' +
    '<div class="sp-stage"></div>';
  head.querySelector('.sp-name').textContent = p.name + ' · ' + p.age + '岁';
  head.querySelector('.sp-stage').textContent = stage.name;
  if (G.state.talent) {
    const badge = document.createElement('div');
    badge.className = 'sp-talent';
    badge.textContent = '天赋 · ' + G.state.talent;
    head.appendChild(badge);
  }
  panel.appendChild(head);

  // 生命条（含濒死警告）
  const hpRatio = Math.max(0, p.hp / p.maxHp);
  const hpBox = document.createElement('div');
  hpBox.className = 'sp-bar-box';
  const hpState = hpRatio <= 0.25 ? 'danger' : (hpRatio <= 0.5 ? 'warn' : 'ok');
  hpBox.innerHTML =
    '<div class="sp-bar-label"><span>生命</span><span>' + p.hp + '/' + p.maxHp + '</span></div>' +
    '<div class="sp-bar"><div class="sp-bar-fill ' + hpState + '" style="width:' +
    (hpRatio * 100).toFixed(1) + '%"></div></div>';
  panel.appendChild(hpBox);

  if (hpRatio <= 0.25) {
    const warn = document.createElement('div');
    warn.className = 'sp-warn';
    warn.textContent = '⚠️ 重伤濒死，行动极易致命';
    panel.appendChild(warn);
  }

  // 主成长属性进度条
  const cur = p.main;
  const need = nextStage ? nextStage.require : cur;
  const prevReq = stage.require;
  const prog = nextStage
    ? Math.max(0, Math.min(1, (cur - prevReq) / Math.max(1, need - prevReq)))
    : 1;
  const mainBox = document.createElement('div');
  mainBox.className = 'sp-bar-box';
  mainBox.innerHTML =
    '<div class="sp-bar-label"><span>' + w.mainAttr.label + '</span><span>' +
    cur + (nextStage ? ' / ' + need : ' (巅峰)') + '</span></div>' +
    '<div class="sp-bar"><div class="sp-bar-fill main" style="width:' +
    (prog * 100).toFixed(1) + '%"></div></div>' +
    (nextStage ? '<div class="sp-next">下一阶段：' + nextStage.name + '</div>' : '');
  panel.appendChild(mainBox);

  // 属性网格：通用 + 专属，两列紧凑排布
  const commonRows = [
    ['财富', p.wealth], ['声望', p.reputation],
    ['势力', p.influence], ['气运', p.luck], ['心情', p.mood]
  ];
  panel.appendChild(buildAttrGroup('通用', commonRows));

  const customRows = w.customAttrs.map(a => [a.label, p.custom[a.key]]);
  panel.appendChild(buildAttrGroup(w.name + '专属', customRows));

  // 底部：回合数
  const foot = document.createElement('div');
  foot.className = 'sp-foot';
  foot.textContent = '第 ' + G.state.turn + ' 次抉择 · 本年已过 ' + (G.state.calendarDays || 0) + ' 天';
  panel.appendChild(foot);
  JourneyUI.render();
}

// 构建一组属性（标题 + 两列网格）
function buildAttrGroup(title, rows) {
  const box = document.createElement('div');
  box.className = 'sp-group';
  const h = document.createElement('div');
  h.className = 'sp-group-title';
  h.textContent = title;
  box.appendChild(h);
  const grid = document.createElement('div');
  grid.className = 'sp-grid';
  rows.forEach(([k, v]) => {
    const cell = document.createElement('div');
    cell.className = 'sp-cell';
    const key = document.createElement('span');
    key.className = 'sp-key';
    key.textContent = k;
    const val = document.createElement('span');
    val.className = 'sp-val';
    val.textContent = v;
    cell.appendChild(key);
    cell.appendChild(val);
    grid.appendChild(cell);
  });
  box.appendChild(grid);
  return box;
}

// ===== 结局 =====
function endGame(reason, type) {
  G.state.status = 'ended';
  G.state.ending = reason;
  clearOptions();
  setInputEnabled(false);
  $('input-hint').textContent = '旅途已结束';

  const w = currentWorld();
  const p = G.state.player;
  const isDeath = type === 'death';
  $('ending-title').textContent = isDeath ? '身死道消' : '传奇落幕';
  $('ending-title').className = isDeath ? 'ending-title death' : 'ending-title';
  $('ending-text').textContent = reason;
  $('ending-stats').innerHTML = '';
  const rows = [
    ['世界', w.name],
    ['最终境界', w.stages[p.stageIndex].name],
    ['享年', p.age + ' 岁'],
    ['经历回合', G.state.turn],
    [w.mainAttr.label, p.main],
    ['财富', p.wealth],
    ['声望', p.reputation]
  ];
  if (G.state.talent) rows.splice(1, 0, ['天赋', G.state.talent]);
  rows.forEach(([k, v]) => {
    const row = document.createElement('div');
    row.className = 'es-row';
    const kk = document.createElement('span');
    kk.textContent = k;
    const vv = document.createElement('b');
    vv.textContent = v;
    row.appendChild(kk);
    row.appendChild(vv);
    $('ending-stats').appendChild(row);
  });

  // 经历回顾：取最近的关键抉择
  const reviewBox = $('ending-review');
  reviewBox.innerHTML = '';
  const log = (G.state.log || []).slice(-8);
  if (log.length) {
    const h = document.createElement('div');
    h.className = 'er-title';
    h.textContent = '— 一生回眸 —';
    reviewBox.appendChild(h);
    log.forEach(item => {
      const div = document.createElement('div');
      div.className = 'er-item';
      div.textContent = '第' + item.turn + '回合 · ' + item.choice;
      reviewBox.appendChild(div);
    });
  }
  $('modal-ending').classList.remove('hidden');
}

function closeEnding() {
  $('modal-ending').classList.add('hidden');
}

// ===== 设置 =====
function openSettings() {
  fillSettingsForm(Storage.loadModelConfig());
  $('modal-settings').classList.remove('hidden');
}

function closeSettings() {
  $('modal-settings').classList.add('hidden');
}

function fillSettingsForm(cfg) {
  $('input-baseurl').value = cfg.baseURL || '';
  $('input-model').value = cfg.model || '';
  $('input-key').value = cfg.apiKey || '';
  // 匹配预设
  const idx = CONFIG.modelPresets.findIndex(
    p => p.baseURL === cfg.baseURL && p.model === cfg.model
  );
  $('preset-select').value = String(idx >= 0 ? idx : CONFIG.modelPresets.length - 1);
  updatePresetInfo();
  $('fetch-status').textContent = '';
  $('model-select-field').classList.add('hidden');
}

// 更新预设说明与获取 Key 的链接
function updatePresetInfo() {
  const p = CONFIG.modelPresets[Number($('preset-select').value)] || {};
  $('preset-note').textContent = p.note ? '💡 ' + p.note : '';
  const link = $('key-link');
  if (p.keyUrl) {
    link.href = p.keyUrl;
    link.classList.remove('hidden');
  } else {
    link.classList.add('hidden');
  }
}

function onPresetChange() {
  const p = CONFIG.modelPresets[Number($('preset-select').value)];
  if (p?.baseURL !== $('input-baseurl').value.trim()) $('input-key').value = '';
  if (p && p.baseURL) {
    $('input-baseurl').value = p.baseURL;
    $('input-model').value = p.model;
  } else {
    $('input-baseurl').value = '';
    $('input-model').value = '';
  }
  updatePresetInfo();
  $('fetch-status').textContent = '';
  $('model-select-field').classList.add('hidden');
}

// 拉取该 Key 下可用的模型列表
async function onFetchModels() {
  const cfg = {
    baseURL: $('input-baseurl').value.trim(),
    apiKey: $('input-key').value.trim()
  };
  const status = $('fetch-status');
  if (!cfg.baseURL || !cfg.apiKey) {
    status.textContent = '请先填写接口地址与 API Key';
    return;
  }
  const btn = $('btn-fetch-models');
  btn.disabled = true;
  status.textContent = '正在获取…';
  try {
    const models = await AI.listModels(cfg);
    if (!models.length) {
      status.textContent = '该服务未返回模型列表，请手动填写模型名';
      return;
    }
    const sel = $('model-select');
    sel.innerHTML = '';
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      sel.appendChild(opt);
    });
    const cur = $('input-model').value.trim();
    if (models.includes(cur)) sel.value = cur;
    $('model-select-field').classList.remove('hidden');
    status.textContent = '✅ 共获取到 ' + models.length + ' 个模型，请在下方选择';
  } catch (e) {
    status.textContent = '⚠️ ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

function onModelSelectChange() {
  $('input-model').value = $('model-select').value;
}

function saveSettings() {
  const presetIdx = Number($('preset-select').value);
  const preset = CONFIG.modelPresets[presetIdx] || {};
  const cfg = {
    name: preset.name || '自定义',
    baseURL: $('input-baseurl').value.trim(),
    model: $('input-model').value.trim(),
    apiKey: $('input-key').value.trim()
  };
  if (!cfg.apiKey) {
    $('fetch-status').textContent = '⚠️ 请填入 API Key';
    return;
  }
  if (!cfg.baseURL || !cfg.model) {
    $('fetch-status').textContent = '⚠️ 接口地址与模型名称不能为空（请在高级设置中填写）';
    return;
  }
  try { cfg.baseURL = ModelTransport.validateBase(cfg.baseURL); }
  catch (error) {
    $('fetch-status').textContent = error.message;
    document.querySelector('.advanced').open = true;
    return;
  }
  Storage.saveModelConfig(cfg);
  $('start-tip').textContent = '本次会话已配置 ' + cfg.name + '。刷新后需重新填写 Key。';
  closeSettings();
}

// ===== 存档 =====
function openSaves() {
  refreshSavesList();
  $('modal-saves').classList.remove('hidden');
}

function closeSaves() {
  $('modal-saves').classList.add('hidden');
}

function refreshSavesList() {
  const list = $('saves-list');
  const saves = Storage.listSaves();
  list.innerHTML = '';
  if (!saves.length) {
    list.innerHTML = '<div class="empty">暂无存档</div>';
    return;
  }
  saves.forEach(s => {
    const item = document.createElement('div');
    item.className = 'save-item';
    const info = document.createElement('div');
    info.className = 'save-info';
    info.textContent = s.worldName + ' · ' + s.playerName + ' · 年龄 ' + s.age + ' · 回合 ' + s.turn;
    const time = document.createElement('div');
    time.className = 'save-time';
    time.textContent = new Date(s.time).toLocaleString();
    info.appendChild(time);
    const actions = document.createElement('div');
    actions.className = 'save-actions';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = '读档';
    loadBtn.addEventListener('click', () => {
      const data = Storage.loadGame(s.id);
      if (data) {
        closeSaves();
        startNewGame(null, null, data);
      }
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'ghost';
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', () => {
      Storage.deleteGame(s.id);
      refreshSavesList();
    });

    actions.appendChild(loadBtn);
    actions.appendChild(delBtn);
    item.appendChild(info);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

function onSaveGame(automatic = false) {
  if (!G.state || G.busy) return;
  const messages = Array.from($('story-area').children)
    .filter(el => el.classList.contains('msg') && !el.classList.contains('thinking') && !el.classList.contains('streaming'))
    .slice(-240).map(el => ({ text: el.textContent, cls: Array.from(el.classList).find(c => c !== 'msg') || 'narrative' }));
  const ok = Storage.saveGame(G.slot, G.state, currentWorld().name, G.history, G.pendingOptions, messages);
  $('save-status').textContent = ok ? (automatic ? '已自动保存 · ' : '已保存 · ') + new Date().toLocaleTimeString() :
    '保存失败：本地空间不足或浏览器禁止存储，请勿关闭页面。';
  return ok;
}

// ===== 星空粒子背景 =====
const StarField = {
  canvas: null,
  ctx: null,
  stars: [],
  meteors: [],
  raf: null,

  init() {
    this.canvas = $('star-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.spawnStars();
    this.loop();
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  spawnStars() {
    const count = Math.min(160, Math.floor(window.innerWidth * window.innerHeight / 9000));
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        r: Math.random() * 1.4 + 0.3,
        baseAlpha: Math.random() * 0.5 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2,
        drift: Math.random() * 0.08 + 0.02
      });
    }
  },

  spawnMeteor() {
    this.meteors.push({
      x: Math.random() * this.canvas.width * 0.7 + this.canvas.width * 0.2,
      y: -20,
      vx: -(Math.random() * 3 + 2.5),
      vy: Math.random() * 3 + 3.5,
      life: 1
    });
  },

  loop() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 星星
    for (const s of this.stars) {
      s.phase += s.twinkleSpeed;
      s.y += s.drift * 0.1;
      if (s.y > h) { s.y = -2; s.x = Math.random() * w; }
      const alpha = s.baseAlpha * (0.6 + 0.4 * Math.sin(s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220, 210, 255, ' + alpha.toFixed(3) + ')';
      ctx.fill();
    }

    // 流星（偶尔）
    if (Math.random() < 0.003 && this.meteors.length < 2) this.spawnMeteor();
    this.meteors = this.meteors.filter(m => m.life > 0 && m.y < h + 60);
    for (const m of this.meteors) {
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 0.012;
      const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 8, m.y - m.vy * 8);
      grad.addColorStop(0, 'rgba(230, 220, 255, ' + (m.life * 0.8).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(230, 220, 255, 0)');
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 8, m.y - m.vy * 8);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    this.raf = requestAnimationFrame(() => this.loop());
  }
};

// 启动
document.addEventListener('DOMContentLoaded', () => {
  init();
});
