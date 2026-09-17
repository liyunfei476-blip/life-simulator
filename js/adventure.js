const Adventure = {
  worlds: {
    xiuxian: { subtitle: '山海有灵，问道无涯', home: '青岚山居', train: '静坐修炼', work: '照料灵田', herb: '灵草', tonic: '回元散', relic: '古玉', routes: ['山脚药谷', '云隐古道', '浮空遗境'], scenes: ['晨露凝在叶尖，淡淡灵气随山风流动。', '石阶消失在云里，远处有清脆铃声。', '旧日石台悬在云海之上，微光沿纹路流转。'], color: '#86baa9', mark: '山' },
    history: { subtitle: '烟火人间，另写一生', home: '河畔小院', train: '研读典籍', work: '手作营生', herb: '药草', tonic: '养元汤', relic: '旧瓷', routes: ['河畔早市', '青石古街', '远山书院'], scenes: ['热茶冒着白气，沿河的摊位渐渐热闹起来。', '雨后的石板泛着光，檐下的手艺人正在收拾工具。', '竹影落在书窗上，纸墨的气息随风而来。'], color: '#d7ac70', mark: '巷' },
    wuxia: { subtitle: '一身行囊，万里江湖', home: '竹间客舍', train: '参悟心法', work: '帮工跑堂', herb: '青叶', tonic: '养息丸', relic: '旧剑穗', routes: ['竹林小径', '渡口茶棚', '听雨山庄'], scenes: ['风吹竹叶，路边石上留着尚未干透的足迹。', '渡船缓缓靠岸，茶棚里有旅人说起远方。', '细雨沿瓦檐滴落，院里的老树挂满红绳。'], color: '#77b7c4', mark: '竹' },
    wasteland: { subtitle: '废墟之上，仍有新生', home: '绿洲营地', train: '研习生存', work: '修复设备', herb: '净化纤维', tonic: '医疗包', relic: '旧电路', routes: ['旧城花园', '遗落车站', '穹顶温室'], scenes: ['草木穿过水泥缝隙，朝阳照亮旧日路标。', '停摆的时钟下，仍有少数机器发出轻响。', '透明穹顶映着云，自动灌溉系统时断时续。'], color: '#c39a70', mark: '墟' },
    scifi: { subtitle: '穿过星尘，抵达未知', home: '晨曦空间站', train: '模拟研究', work: '维护舱室', herb: '生物凝胶', tonic: '修复剂', relic: '数据晶体', routes: ['星港回廊', '环带观测站', '远航生态舱'], scenes: ['观景窗外星环缓缓转动，补给艇正在入港。', '观测屏跳出一串陌生信号，舱外只有静默星尘。', '人工晨光照亮植物，舱壁保留着漫长航行的痕迹。'], color: '#78b6dd', mark: '星' },
    magic: { subtitle: '月光为引，万物有声', home: '月影小屋', train: '奥术冥想', work: '整理藏书', herb: '月露花', tonic: '复苏药剂', relic: '符文石', routes: ['萤光林地', '古树回廊', '月辉图书塔'], scenes: ['点点微光停在枝头，林间小路散发清香。', '盘结树根围出拱门，细小符文浮现在树皮上。', '书页无风自动，月光沿旋梯静静流淌。'], color: '#b69bdd', mark: '月' }
  },
  events: [
    { title: '意外的收获', text: '一处不起眼的角落里藏着可用的材料。你可以仔细收集，也可以花时间追寻附近的线索。', choices: ['仔细收集', '寻找更多线索', '记下位置返回'] },
    { title: '旅人的请求', text: '一位旅人正为遗落的行囊发愁。他愿意用一份补给感谢帮助，也愿意与你交换沿途的见闻。', choices: ['帮忙找回行囊', '交换沿途见闻', '礼貌道别'] },
    { title: '旧物与新知', text: '一件旧物的纹路引起你的注意。耐心辨认也许能有所领悟；带回去整理，或许同样有价值。', choices: ['专注研究纹路', '带回旧物', '谨慎离开'] },
    { title: '岔路之间', text: '眼前出现一条尚未标记的小路。你可以试着走得更远，也可以只观察入口，不贸然进入。', choices: ['深入未知道路', '观察入口痕迹', '沿原路返回'] },
    { title: '一场小小的考验', text: '通路需要修整才能继续。你可以亲手处理，也可以花些资源请熟悉此地的人协助。', choices: ['亲手修整通路', '请人协助', '暂时绕行'] },
    { title: '静谧的片刻', text: '一处避风的地方让你得以喘息。是停下来恢复精神，还是趁天色尚好继续收集？', choices: ['静坐片刻', '收集周围材料', '记录此地风物'] },
    { title: '手艺人的课堂', text: '一位手艺人正在耐心演示自己的技巧。你可以留下学习，也可以用劳动换取一些材料。', choices: ['留下学习技巧', '帮忙整理材料', '道谢离开'] },
    { title: '失落的手记', text: '你发现几页被风吹散的手记。其中既有关于此地的观察，也有未完成的练习。', choices: ['整理并研读', '寻找手记主人', '原地妥善放好'] },
    { title: '小小的交换会', text: '几位旅人在此交换闲置物品。不妨提供一些帮助换取报酬，或者记录他们介绍的经验。', choices: ['协助整理摊位', '听取旅行经验', '继续自己的旅途'] },
    { title: '天气的提醒', text: '天色忽然改变，眼前的景物渐渐被雾笼罩。绕到避风处或许更稳妥，留在原地等待也不失为一个选择。', choices: ['寻找避风处', '原地等待放晴', '提前结束探索'] }
  ],
  goals: [
    { id: 'first-step', name: '初识此界', desc: '完成 3 次探索事件', key: 'explored', target: 3, reward: 35 },
    { id: 'steady', name: '日有所进', desc: '完成 5 次研习', key: 'trained', target: 5, reward: 50 },
    { id: 'maker', name: '自给自足', desc: '制作 2 份恢复品', key: 'crafted', target: 2, reward: 40 },
    { id: 'far-away', name: '行至远方', desc: '完成 10 次探索事件', key: 'explored', target: 10, reward: 100 },
    { id: 'livelihood', name: '安身立命', desc: '完成 5 次营生', key: 'worked', target: 5, reward: 50 }
  ],

  theme(id) { return this.worlds[id] || this.worlds.xiuxian; },
  create() {
    return { energy: 100, inventory: { herb: 0, tonic: 2, relic: 0 }, explored: 0, trained: 0,
      worked: 0, crafted: 0, visited: [0, 0, 0], claimed: [], pending: null, lastEvent: -1, location: -1 };
  },
  normalize(source) {
    const result = this.create();
    if (!source || typeof source !== 'object' || Array.isArray(source)) return result;
    const integer = (value, fallback, max) => Number.isInteger(value) && value >= 0 && value <= max ? value : fallback;
    result.energy = integer(source.energy, 100, 100);
    for (const key of ['explored', 'trained', 'worked', 'crafted']) result[key] = integer(source[key], 0, 100000);
    for (const key of ['herb', 'tonic', 'relic']) result.inventory[key] = integer(source.inventory?.[key], result.inventory[key], 9999);
    result.visited = [0, 1, 2].map(i => integer(source.visited?.[i], 0, 100000));
    result.claimed = this.goals.filter(g => Array.isArray(source.claimed) && source.claimed.includes(g.id)).map(g => g.id);
    result.location = integer(source.location, -1, 2);
    result.lastEvent = integer(source.lastEvent, -1, this.events.length - 1);
    const pending = source.pending;
    if (pending && Number.isInteger(pending.route) && pending.route >= 0 && pending.route <= 2 &&
        Number.isInteger(pending.event) && pending.event >= 0 && pending.event < this.events.length) {
      result.pending = { route: pending.route, event: pending.event };
    }
    return result;
  },
  options(state) {
    const pending = state.adventure?.pending;
    if (!pending) return [];
    const event = this.events[pending.event];
    return event.choices.map((text, index) => ({ text, actionId: 'encounter:' + index,
      risk: pending.event === 3 && index === 0 ? '有风险，可能无功而返' :
        pending.event === 4 && index === 1 ? '花费 12 财富' : '即时结算' }));
  },
  growth(state, factor = 1) {
    const w = getWorld(state.worldId);
    const i = state.player.stageIndex;
    const gap = (w.stages[i + 1]?.require || w.stages[i].require + 60) - w.stages[i].require;
    return Math.max(5, Math.round(gap * .18 * factor));
  },
  available(state, id) {
    if (!state || state.status !== 'playing') return '旅途已结束';
    if (typeof id !== 'string') return '未知行动';
    if (checkTriggers(state).some(t => t.type === 'death')) return '当前状态已无法行动';
    const a = state.adventure || this.create();
    if (a.pending && !id.startsWith('encounter:') && id !== 'use') return '先处理眼前的探索事件';
    if (id.startsWith('explore:')) {
      const route = Number(id.slice(8));
      if (!Number.isInteger(route) || route < 0 || route > 2) return '地点不存在';
      if (a.explored < route * 3) return '完成 ' + route * 3 + ' 次探索后解锁';
      if (a.energy < 12) return '精力不足 12，请先休整';
    } else if (id === 'train' && a.energy < 18) return '精力不足 18，请先休整';
    else if (id === 'work' && a.energy < 12) return '精力不足 12，请先休整';
    else if (id === 'brew' && a.inventory.herb < 3) return '需要 3 份材料';
    else if (id === 'buy' && state.player.wealth < 20) return '需要 20 财富';
    else if (id === 'use' && a.inventory.tonic < 1) return '没有恢复品';
    else if (id === 'use' && state.player.hp >= state.player.maxHp) return '生命已满，无需消耗';
    else if (id === 'sell' && a.inventory.relic < 1) return '没有可出售的旧物';
    else if (id.startsWith('encounter:')) {
      const choice = Number(id.slice(10));
      if (!a.pending || !Number.isInteger(choice) || choice < 0 || choice > 2) return '事件已结束或选择无效';
      if (a.pending.event === 4 && choice === 1 && state.player.wealth < 12) return '需要 12 财富';
    } else if (id.startsWith('claim:')) {
      const goal = this.goals.find(g => g.id === id.slice(6));
      if (!goal || a[goal.key] < goal.target) return '尚未达成目标';
      if (a.claimed.includes(goal.id)) return '奖励已领取';
    } else if (!['train', 'work', 'rest', 'brew', 'buy', 'use', 'sell'].includes(id)) return '未知行动';
    if (['brew', 'buy'].includes(id) && a.inventory.tonic >= 9999) return '背包已满';
    return '';
  },
  act(previous, id) {
    const error = this.available(previous, id);
    if (error) throw new Error(error);
    const draft = JSON.parse(JSON.stringify(previous));
    draft.adventure = this.normalize(draft.adventure);
    const a = draft.adventure;
    const theme = this.theme(draft.worldId);
    const world = getWorld(draft.worldId);
    let narrative = '', label = '', days = 7, danger = 'none';
    const effects = {};
    if (id.startsWith('explore:')) {
      const route = Number(id.slice(8));
      const candidates = this.events.map((_, i) => i).filter(i => i !== a.lastEvent);
      const event = candidates[Math.floor(Math.random() * candidates.length)];
      a.pending = { route, event }; a.location = route; a.lastEvent = event; a.energy -= 12;
      return { state: draft, messages: ['精力 −12 · 选择后推进时间'], fate: 'safe',
        narrative: theme.routes[route] + ' · ' + this.events[event].title + '\n' + theme.scenes[route] + '\n' + this.events[event].text,
        options: this.options(draft), label: '前往' + theme.routes[route] };
    }
    if (id.startsWith('encounter:')) {
      const choice = Number(id.slice(10));
      const { route, event } = a.pending;
      label = this.events[event].choices[choice];
      narrative = theme.routes[route] + ' · ';
      if (choice === 2) {
        narrative += '你把沿途所见记在心里，稳妥地结束了这次旅程。'; effects.心情 = 5;
      } else if (event === 0 || (event === 5 && choice === 1)) {
        const count = choice === 0 ? 2 + route : 1 + route;
        a.inventory.herb = Math.min(9999, a.inventory.herb + count);
        narrative += '你辨认并收集了 ' + count + ' 份' + theme.herb + '，妥善收进行囊。';
      } else if (event === 1) {
        effects.声望 = choice === 0 ? 8 : 3;
        if (choice === 0) { a.inventory.tonic = Math.min(9999, a.inventory.tonic + 1); narrative += '你帮旅人找到遗落的行囊，收到一份' + theme.tonic + '作为答谢。'; }
        else { effects[world.mainAttr.key] = this.growth(draft, .5); narrative += '一番交流让你对这片天地有了新的认识。'; }
      } else if (event === 2) {
        if (choice === 0) { effects[world.mainAttr.key] = this.growth(draft, .8); narrative += '你从反复观察中有所领悟，先前模糊的思路逐渐清晰。'; }
        else { a.inventory.relic = Math.min(9999, a.inventory.relic + 1); narrative += '你将一件' + theme.relic + '带回，准备日后整理或出售。'; }
      } else if (event === 3) {
        if (choice === 0) {
          danger = route === 2 ? 'medium' : 'low';
          effects[world.mainAttr.key] = this.growth(draft, 1.3);
          narrative += '未知的环境让你有所发现，但前路忽然变得险峻。你必须先渡过眼前的难关。';
        } else { effects.声望 = 4; narrative += '你只在入口处做了记录，没有贸然深入。沿途标记将帮助后来的人。'; }
      } else if (event === 4) {
        effects.财富 = choice === 1 ? -12 : 8;
        effects.声望 = 5;
        a.energy = Math.max(0, a.energy - (choice === 0 ? 8 : 0));
        narrative += choice === 0 ? '你花了一番力气修整通路，同行者给了你一些报酬。' : '在熟悉地形的人帮助下，你顺利通过了这段道路。';
      } else if (event === 6) {
        if (choice === 0) { effects[world.mainAttr.key] = this.growth(draft, .65); narrative += '你认真练习，学会了几种值得反复琢磨的技巧。'; }
        else { a.inventory.herb = Math.min(9999, a.inventory.herb + 2); narrative += '你帮忙完成整理，得到两份' + theme.herb + '。'; }
      } else if (event === 7) {
        if (choice === 0) { effects[world.mainAttr.key] = this.growth(draft, .7); narrative += '你逐页理清手记中的思路，新的理解在心中生根。'; }
        else { effects.声望 = 9; effects.心情 = 5; narrative += '手记回到了主人手中，对方郑重向你道谢。'; }
      } else if (event === 8) {
        if (choice === 0) { effects.财富 = 15; narrative += '你用细心的整理换来一份报酬，也认识了几位友善的旅人。'; }
        else { effects[world.mainAttr.key] = this.growth(draft, .6); narrative += '不同旅人的经验让你少走了许多弯路。'; }
      } else if (event === 9) {
        effects.心情 = 6; a.energy = Math.min(100, a.energy + (choice === 0 ? 5 : 12));
        narrative += choice === 0 ? '你找到了遮蔽风雨的地方，耐心等待天气恢复。' : '你决定不勉强前行。雾散之后，眼前的道路又清晰起来。';
      } else {
        effects.生命 = 12; effects.心情 = 10; a.energy = Math.min(100, a.energy + 15);
        narrative += '一段安静的休息让呼吸重新平稳，也让你找回继续前行的精神。';
      }
      a.explored++; a.visited[route]++; a.pending = null; days = 14;
    } else if (id === 'train') {
      label = theme.train; days = 60; a.energy -= 18; a.trained++;
      const success = Math.random() < .85;
      effects[world.mainAttr.key] = this.growth(draft, success ? 1 : .35);
      effects.心情 = success ? 3 : -3;
      narrative = success ? '你在' + theme.home + '潜心研习。积累的经验逐渐连成脉络，这一段专注让你有了扎实的长进。' : '你遭遇了一个难以理解的瓶颈。虽然没有取得预期进展，但反复尝试仍积累了一些经验。';
    } else if (id === 'rest') {
      label = '安心休整'; days = 7; a.location = -1;
      a.energy = Math.min(100, a.energy + 40); effects.生命 = 24; effects.心情 = 12;
      if (draft.worldId === 'wasteland') effects.感染度 = -5;
      narrative = '你回到' + theme.home + '，放下行囊，好好休息。窗外景色缓缓变化，你不必时刻追赶命运。';
    } else if (id === 'work') {
      label = theme.work; days = 30; a.energy -= 12; a.worked++; effects.财富 = 18 + draft.player.stageIndex * 4;
      narrative = '你在' + theme.home + '附近做了一段' + theme.work + '的活计。生活未必时时惊天动地，这份踏实的报酬足够支持下一段旅途。';
    } else if (id === 'brew') {
      label = '制作' + theme.tonic; days = 1; a.inventory.herb -= 3; a.inventory.tonic++; a.crafted++;
      narrative = '你按照已经掌握的方法处理材料，制成一份' + theme.tonic + '。';
    } else if (id === 'buy') {
      label = '购入' + theme.tonic; days = 1; effects.财富 = -20; a.inventory.tonic++;
      narrative = '你花费 20 财富补充了一份' + theme.tonic + '，为后续旅程作准备。';
    } else if (id === 'use') {
      label = '使用' + theme.tonic; days = 1; a.inventory.tonic--; effects.生命 = 40;
      narrative = '你使用一份' + theme.tonic + '恢复身体，感觉好了一些。';
    } else if (id === 'sell') {
      label = '出售' + theme.relic; days = 1; a.inventory.relic--; effects.财富 = 25;
      narrative = '你将一件' + theme.relic + '转让给需要它的人，获得 25 财富。';
    } else {
      const goal = this.goals.find(g => g.id === id.slice(6));
      a.claimed.push(goal.id); effects.财富 = goal.reward; effects.声望 = 5;
      label = '领取目标奖励'; days = 0;
      narrative = '「' + goal.name + '」已经完成。那些看似微小的坚持，终于成为你旅程的一部分。';
    }
    const settled = settleAction(draft, { effects, danger, combat: false }, label, days);
    return { ...settled, narrative, label, options: this.options(settled.state) };
  }
};
