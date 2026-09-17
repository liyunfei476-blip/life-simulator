// ===== 存档系统：localStorage 多存档槽 =====
const Storage = {
  KEY_PREFIX: 'crossing_sim_',
  modelSession: null,

  loadModelConfig() {
    if (this.modelSession) return { ...this.modelSession };
    let cfg = { ...CONFIG.defaultModel };
    try {
      const saved = JSON.parse(localStorage.getItem(this.KEY_PREFIX + 'model') || 'null');
      if (saved && typeof saved === 'object') {
        for (const key of ['name', 'baseURL', 'model', 'apiKey']) {
          if (typeof saved[key] === 'string') cfg[key] = saved[key];
        }
        this.modelSession = cfg;
        this.saveModelConfig(cfg);
      }
    } catch { /* 浏览器可能禁止本地存储。 */ }
    this.modelSession = cfg;
    return { ...cfg };
  },

  saveModelConfig(cfg) {
    this.modelSession = { name: cfg.name, baseURL: cfg.baseURL, model: cfg.model, apiKey: cfg.apiKey || '' };
    try {
      localStorage.setItem(this.KEY_PREFIX + 'model', JSON.stringify({
        name: cfg.name, baseURL: cfg.baseURL, model: cfg.model
      }));
      return true;
    } catch { return false; }
  },

  // 列出所有存档元信息
  listSaves() {
    const saves = [];
    let keys;
    try { keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)); }
    catch { return saves; }
    for (const k of keys) {
      if (k && k.startsWith(this.KEY_PREFIX + 'save_')) {
        try {
          const s = JSON.parse(localStorage.getItem(k));
          saves.push({
            id: k.replace(this.KEY_PREFIX + 'save_', ''),
            worldName: s.worldName,
            playerName: s.state.player.name,
            age: s.state.player.age,
            turn: s.state.turn,
            time: s.time
          });
        } catch (e) { /* ignore */ }
      }
    }
    saves.sort((a, b) => (b.time || 0) - (a.time || 0));
    return saves;
  },

  normalizeSave(data) {
    if (!data || (data.version !== undefined && data.version !== 2)) throw new Error('存档版本不支持');
    const source = data.state;
    const world = WORLDS.find(w => w.id === source?.worldId);
    if (!world || !source.player || !['playing', 'ended'].includes(source.status)) throw new Error('存档无效');
    const state = createInitialState(world.id, String(source.player.name || '无名氏').slice(0, 12));
    for (const key of Object.keys(state.player)) {
      if (key === 'name' || key === 'custom') continue;
      const value = source.player[key];
      if (!Number.isFinite(value) || Math.abs(value) > 1000000) throw new Error('存档属性无效');
      state.player[key] = value;
    }
    const p = state.player;
    if (!Number.isInteger(p.stageIndex) || p.stageIndex < 0 || p.stageIndex >= world.stages.length ||
        p.maxHp < 1 || p.hp < 0 || p.hp > p.maxHp || p.age < 0 || p.main < 0) throw new Error('存档状态无效');
    p.luck = Math.max(0, Math.min(100, p.luck));
    p.mood = Math.max(0, Math.min(100, p.mood));
    for (const attr of world.customAttrs) {
      const value = source.player.custom?.[attr.key];
      if (!Number.isFinite(value) || Math.abs(value) > 1000000) throw new Error('存档属性无效');
      p.custom[attr.key] = Math.max(0, value);
    }
    if (!Number.isInteger(source.turn) || source.turn < 0 || source.turn > 1000000) throw new Error('回合无效');
    state.turn = source.turn;
    state.calendarDays = Number.isInteger(source.calendarDays) && source.calendarDays >= 0 && source.calendarDays < 365 ? source.calendarDays : 0;
    state.adventure = Adventure.normalize(source.adventure);
    state.status = source.status;
    state.ending = typeof source.ending === 'string' ? source.ending.slice(0, 6000) : null;
    state.endingType = typeof source.endingType === 'string' ? source.endingType : (p.hp === 0 ? 'death' : 'complete');
    state.talent = typeof source.talent === 'string' ? source.talent.slice(0, 40) : null;
    state.log = (Array.isArray(source.log) ? source.log : []).slice(-300)
      .filter(item => item && Number.isFinite(item.turn) && typeof item.choice === 'string')
      .map(item => ({ turn: item.turn, choice: item.choice.slice(0, 200) }));
    const history = (Array.isArray(data.history) ? data.history : []).slice(-CONFIG.MAX_HISTORY)
      .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 6000) }));
    const options = (Array.isArray(data.options) ? data.options : []).slice(0, 4)
      .filter(o => o && typeof o.text === 'string')
      .map(o => ({ text: o.text.slice(0, 200), risk: typeof o.risk === 'string' ? o.risk.slice(0, 160) : '' }));
    if (state.status === 'ended') options.splice(0);
    else if (state.adventure.pending) options.splice(0, options.length, ...Adventure.options(state));
    const classes = ['opening', 'narrative', 'choice', 'ask', 'answer', 'effects', 'promotion', 'combat', 'fate-safe'];
    const messages = (Array.isArray(data.messages) ? data.messages : []).slice(-240)
      .filter(m => m && typeof m.text === 'string')
      .map(m => ({ text: m.text.slice(0, 6000), cls: classes.includes(m.cls) ? m.cls : 'narrative' }));
    return { version: 2, state, worldName: world.name, history, options, messages,
      time: Number.isFinite(data.time) ? data.time : 0 };
  },

  saveGame(slot, state, worldName, history, options = [], messages = []) {
    try {
      const data = this.normalizeSave({ state, history, options, messages, time: Date.now() });
      localStorage.setItem(this.KEY_PREFIX + 'save_' + slot, JSON.stringify(data));
      return true;
    } catch { return false; }
  },

  loadGame(slot) {
    try {
      const raw = localStorage.getItem(this.KEY_PREFIX + 'save_' + slot);
      if (!raw || raw.length > 3000000) return null;
      return { ...this.normalizeSave(JSON.parse(raw)), slot };
    } catch { return null; }
  },

  // 删除指定槽位
  deleteGame(slot) {
    localStorage.removeItem(this.KEY_PREFIX + 'save_' + slot);
  },

  // 生成新存档槽位名（时间戳）
  newSlot() {
    return 'slot_' + Date.now();
  }
};
