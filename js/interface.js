const JourneyUI = {
  tab: 'map',
  reading: false,
  fontSize: 18,
  toastTimer: null,

  init() {
    $('btn-new-journey').addEventListener('click', () => this.showSetup());
    $('btn-continue').addEventListener('click', () => this.continueGame());
    $('btn-home-settings').addEventListener('click', openSettings);
    $('btn-home-saves').addEventListener('click', openSaves);
    $('btn-setup-back').addEventListener('click', () => this.home());
    $('btn-journey-panel').addEventListener('click', () => this.togglePanel());
    $('btn-close-panel').addEventListener('click', () => this.togglePanel(false));
    $('btn-read-mode').addEventListener('click', () => {
      this.reading = !this.reading;
      $('screen-game').classList.toggle('reading-mode', this.reading);
      $('btn-read-mode').setAttribute('aria-pressed', String(this.reading));
    });
    $('btn-font-size').addEventListener('click', () => {
      this.fontSize = this.fontSize === 22 ? 16 : this.fontSize + 2;
      document.documentElement.style.setProperty('--reading-size', this.fontSize + 'px');
      this.toast('正文字号 ' + this.fontSize + 'px');
    });
    $('btn-latest').addEventListener('click', scrollToBottom);
    $('btn-export-save').addEventListener('click', () => this.exportSave());
    $('input-import-save').addEventListener('change', event => this.importSave(event));
    document.querySelectorAll('[data-journey-tab]').forEach(button => {
      button.addEventListener('click', () => this.openTab(button.dataset.journeyTab));
    });
    document.querySelectorAll('[data-local-action]').forEach(button => {
      button.addEventListener('click', () => this.act(button.dataset.localAction));
    });
    $('btn-explore').addEventListener('click', () => this.openTab('map'));
    $('btn-inventory').addEventListener('click', () => this.openTab('bag'));
    const gallery = $('home-worlds');
    WORLDS.forEach((world, index) => {
      const button = document.createElement('button');
      button.className = 'home-world';
      button.dataset.world = world.id;
      const art = document.createElement('span'); art.className = 'atlas-art';
      art.style.backgroundPosition = this.position(index);
      const name = document.createElement('strong'); name.textContent = world.name;
      const sub = document.createElement('small'); sub.textContent = Adventure.theme(world.id).subtitle;
      button.append(art, name, sub);
      button.addEventListener('click', () => this.showSetup(world.id));
      gallery.appendChild(button);
    });
    this.updateContinue();
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.modal').forEach(el => el.classList.add('hidden'));
      this.togglePanel(false);
      $('status-panel').classList.remove('open');
    });
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', event => { if (event.target === modal) modal.classList.add('hidden'); });
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && G.state && !G.busy) onSaveGame(true); });
  },
  position(index) { return (index % 3) * 50 + '% ' + Math.floor(index / 3) * 100 + '%'; },
  showSetup(id) {
    $('screen-home').classList.add('hidden');
    $('screen-start').classList.remove('hidden');
    if (id) selectWorld(id);
    $('screen-start').scrollTop = 0;
  },
  home() {
    $('screen-start').classList.add('hidden');
    $('screen-home').classList.remove('hidden');
    this.updateContinue();
  },
  updateContinue() {
    const saves = Storage.listSaves();
    $('btn-continue').disabled = !saves.length;
    $('home-save-info').textContent = saves.length ? '最近旅程 · ' + saves[0].worldName + ' · ' + saves[0].playerName : '从一段全新的人生开始';
  },
  continueGame() {
    const saves = Storage.listSaves();
    const saved = saves.length ? Storage.loadGame(saves[0].id) : null;
    if (!saved) { this.toast('没有可用的存档，请在存档管理中检查。'); return; }
    startNewGame(null, null, saved);
  },
  toast(text) {
    clearTimeout(this.toastTimer);
    $('toast').textContent = text;
    $('toast').classList.remove('hidden');
    this.toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 4500);
  },
  togglePanel(open) {
    const panel = $('journey-panel');
    panel.classList.toggle('open', open === undefined ? !panel.classList.contains('open') : open);
    $('btn-journey-panel').setAttribute('aria-expanded', String(panel.classList.contains('open')));
  },
  openTab(tab) {
    this.tab = tab;
    this.render();
    this.togglePanel(true);
  },
  node(tag, cls, text) {
    const el = document.createElement(tag); el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  },
  actionButton(text, id) {
    const button = this.node('button', 'panel-action', text);
    const reason = Adventure.available(G.state, id);
    button.disabled = G.busy || !!reason;
    button.title = reason || '即时结算，不请求 AI';
    button.addEventListener('click', () => this.act(id));
    return button;
  },
  render() {
    if (!G.state) return;
    const state = G.state, a = state.adventure || Adventure.create();
    const theme = Adventure.theme(state.worldId);
    const index = WORLDS.findIndex(w => w.id === state.worldId);
    $('screen-game').style.setProperty('--theme', theme.color);
    $('scene-art').style.backgroundPosition = this.position(index);
    $('scene-location').textContent = a.location < 0 ? theme.home : theme.routes[a.location];
    $('scene-subtitle').textContent = theme.subtitle;
    $('game-date').textContent = state.player.age + ' 岁 · 第 ' + (Math.floor((state.calendarDays || 0) / 30) + 1) + ' 月 · ' + state.turn + ' 次抉择';
    $('energy-label').textContent = '精力 ' + a.energy + '/100';
    $('btn-train').textContent = theme.train;
    $('btn-work').textContent = theme.work;
    $('mode-badge').textContent = hasAIConfig() ? 'AI 自由叙事 + 即时玩法' : '本地旅程 · 即时响应';
    document.querySelectorAll('[data-local-action]').forEach(button => {
      const reason = Adventure.available(state, button.dataset.localAction);
      button.disabled = G.busy || !!reason;
      button.title = reason || (button.dataset.localAction === 'rest' ? '7 天 · 精力 +40，生命 +24' : '本地结算，无需等待 AI');
    });
    document.querySelectorAll('[data-journey-tab]').forEach(button => {
      button.setAttribute('aria-selected', String(button.dataset.journeyTab === this.tab));
    });
    const body = $('journey-content'); body.replaceChildren();
    if (this.tab === 'map') {
      body.appendChild(this.node('p', 'panel-intro', a.pending ? '眼前还有未处理的事件，请在剧情下方作出选择。' : '每次探索消耗 12 精力。不同地点会带来不同风物与收获。'));
      theme.routes.forEach((name, route) => {
        const card = this.node('article', 'route-card');
        card.append(this.node('span', 'route-number', '0' + (route + 1)), this.node('h3', '', name),
          this.node('p', '', theme.scenes[route]), this.node('small', '', '已探索 ' + a.visited[route] + ' 次'));
        const locked = a.explored < route * 3;
        card.appendChild(this.actionButton(locked ? route * 3 + ' 次探索后解锁' : '前往探索 →', 'explore:' + route));
        body.appendChild(card);
      });
    } else if (this.tab === 'bag') {
      body.appendChild(this.node('p', 'panel-intro', '制作与交易各耗时 1 天。恢复品仅在受伤时可用，不会消耗空物品。'));
      for (const [key, name, desc] of [['herb', theme.herb, '探索获得，3 份可制作恢复品'], ['tonic', theme.tonic, '使用后恢复 40 生命'], ['relic', theme.relic, '出售可获得 25 财富']]) {
        const card = this.node('article', 'inventory-card');
        card.append(this.node('strong', '', name), this.node('b', '', '× ' + a.inventory[key]), this.node('p', '', desc));
        body.appendChild(card);
      }
      const actions = this.node('div', 'panel-actions');
      actions.append(this.actionButton('使用恢复品', 'use'), this.actionButton('材料制作', 'brew'),
        this.actionButton('购买 · 20 财富', 'buy'), this.actionButton('出售旧物', 'sell'));
      body.appendChild(actions);
    } else if (this.tab === 'goals') {
      body.appendChild(this.node('p', 'panel-intro', '这些是可选的小目标，不是必须走的主线。每项奖励只能领取一次。'));
      Adventure.goals.forEach(goal => {
        const card = this.node('article', 'goal-card');
        const count = Math.min(a[goal.key], goal.target);
        const progress = document.createElement('progress'); progress.max = goal.target; progress.value = count;
        card.append(this.node('h3', '', goal.name), this.node('p', '', goal.desc + ' · ' + count + '/' + goal.target), progress,
          this.actionButton(a.claimed.includes(goal.id) ? '已领取' : '领取 · ' + goal.reward + ' 财富', 'claim:' + goal.id));
        body.appendChild(card);
      });
    } else {
      body.appendChild(this.node('p', 'panel-intro', '你的每一次决定，都成为旅程的一部分。这里保留最近 30 次抉择。'));
      const log = state.log.slice(-30).reverse();
      if (!log.length) body.appendChild(this.node('p', 'panel-empty', '故事尚未落笔。'));
      log.forEach(item => {
        const row = this.node('article', 'journal-entry');
        row.append(this.node('small', '', '第 ' + item.turn + ' 次抉择'), this.node('p', '', item.choice));
        body.appendChild(row);
      });
    }
  },
  act(id) {
    if (G.busy || !G.state) return;
    try {
      const settled = Adventure.act(G.state, id);
      G.retry = null;
      $('generation-recovery').classList.add('hidden');
      appendInstant(settled.label, 'choice');
      appendInstant(settled.narrative, 'narrative');
      G.state = settled.state;
      G.history.push({ role: 'user', content: settled.label },
        { role: 'assistant', content: settled.narrative + '\n结算：' + settled.messages.join('；') });
      settled.messages.forEach(message => appendInstant(message, 'effects'));
      G.pendingOptions = G.state.status === 'ended' ? [] : settled.options;
      trimHistory(); renderStatus(); renderOptions(G.pendingOptions); setInputEnabled(G.state.status === 'playing');
      if (G.state.status === 'ended') endGame(G.state.ending, G.state.endingType);
      onSaveGame(true);
      if (id.startsWith('explore:')) this.togglePanel(false);
    } catch (error) { this.toast(error.message); }
  },
  exportSave() {
    if (!G.state || G.busy) { this.toast('请在游戏中完成当前行动后导出。'); return; }
    if (!onSaveGame(true)) { this.toast('当前进度保存失败，未导出旧存档。'); return; }
    const saved = Storage.loadGame(G.slot);
    if (!saved) { this.toast('无法读取存档，请先检查保存状态。'); return; }
    const blob = new Blob([JSON.stringify(Storage.normalizeSave(saved), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'crossing-life-save.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toast('已导出游戏进度，不包含模型配置。');
  },
  async importSave(event) {
    const input = event.target, file = input.files?.[0]; input.value = '';
    if (!file) return;
    if (G.busy) { this.toast('请先完成或取消当前生成。'); return; }
    if (file.size > 3000000) { this.toast('存档不能超过 3MB。'); return; }
    try {
      const saved = Storage.normalizeSave(JSON.parse(await file.text()));
      if (G.busy) throw new Error('当前正在生成，请稍后导入。');
      const slot = Storage.newSlot();
      if (!Storage.saveGame(slot, saved.state, saved.worldName, saved.history, saved.options, saved.messages)) throw new Error('存储空间不足，导入失败。');
      refreshSavesList(); this.updateContinue(); this.toast('已导入为独立存档，原有进度没有覆盖。');
    } catch { this.toast('存档格式无效、版本不支持或本地存储不可用。'); }
  }
};
