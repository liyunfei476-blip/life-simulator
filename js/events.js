// ===== 事件系统：随机判定 + 本地兜底事件池 =====

// 本地兜底事件池（AI 不可用时保证可玩性）
const LOCAL_EVENTS = [
  {
    text: '你在荒野中遇到一名受伤的旅人。',
    options: [
      { text: '出手相助', risk: '可能耗费财物，但或得回报' },
      { text: '趁火打劫', risk: '可能树敌' },
      { text: '视而不见', risk: '内心不安' }
    ]
  },
  {
    text: '前方小镇正在举行集市，热闹非凡。',
    options: [
      { text: '摆摊做生意', risk: '有机会赚取财富' },
      { text: '打听消息', risk: '可能获得有用情报' },
      { text: '低调路过', risk: '错失机会' }
    ]
  },
  {
    text: '夜幕降临，你在一处废弃庙宇中歇脚，隐约听见异响。',
    options: [
      { text: '上前查看', risk: '可能遭遇危险' },
      { text: '严阵以待', risk: '保守但安全' },
      { text: '连夜离开', risk: '损失休息，身心疲惫' }
    ]
  },
  {
    text: '一名神秘人拦住了你的去路，似有来意。',
    options: [
      { text: '主动攀谈', risk: '或有奇遇' },
      { text: '警惕戒备', risk: '可能错过机缘' },
      { text: '绕道而行', risk: '可能被尾随' }
    ]
  },
  {
    text: '你偶然发现一处隐蔽的山洞，洞口透着微光。',
    options: [
      { text: '大胆进入', risk: '可能发现宝藏或危险' },
      { text: '做足准备再进', risk: '稳妥但可能被人捷足先登' },
      { text: '标记后离开', risk: '留待日后' }
    ]
  }
];

// 随机抽取本地事件
function pickLocalEvent() {
  return LOCAL_EVENTS[Math.floor(Math.random() * LOCAL_EVENTS.length)];
}

// 根据选项文本，做确定性/随机的本地结算（AI 不可用时的兜底）
function localResolve(state, optionText) {
  const p = state.player;
  const outcomes = {
    '出手相助': { effects: { 财富: -5, 声望: 8, 心情: 5 } },
    '趁火打劫': { effects: { 财富: 12, 声望: -8, 心情: -5 } },
    '视而不见': { effects: { 心情: -3 } },
    '摆摊做生意': { effects: { 财富: 15, 心情: -5 } },
    '打听消息': { effects: { 声望: 5 } },
    '低调路过': { effects: {} },
    '上前查看': { effects: { 生命: -10, 气运: 8 } },
    '严阵以待': { effects: { 心情: -3 } },
    '连夜离开': { effects: { 生命: -5 } },
    '主动攀谈': { effects: { 气运: 10 } },
    '警惕戒备': { effects: {} },
    '绕道而行': { effects: {} },
    '大胆进入': { effects: { 气运: 12, 生命: -8 } },
    '做足准备再进': { effects: { 气运: 5 } },
    '标记后离开': { effects: {} }
  };
  const hit = outcomes[optionText];
  return hit ? { ...hit.effects } : {};
}

// 本地模式下按关键词粗略判断危险等级（无 AI 时也要有生死风险）
function localGuessDanger(text) {
  const t = String(text || '');
  const extreme = ['自杀', '自尽', '自刎', '跳崖', '跳下', '寻死', '了结自己', '服毒', '割腕', '引爆', '同归于尽'];
  const high = ['单挑', '硬闯', '强攻', '刺杀', '偷袭', '闯入', '深入', '越级', '挑战', '拼命', '死战'];
  const medium = ['战斗', '厮杀', '交手', '逃亡', '追杀', '冒险', '潜入', '盗取', '欺骗', '背叛', '大胆进入'];
  const low = ['探查', '查看', '打探', '试探', '涉险', '夜行', '上前查看', '连夜离开'];

  if (extreme.some(k => t.includes(k))) return 'extreme';
  if (high.some(k => t.includes(k))) return 'high';
  if (medium.some(k => t.includes(k))) return 'medium';
  if (low.some(k => t.includes(k))) return 'low';
  // 其余行为也有极小概率遇险，让世界保持不确定性
  return Math.random() < 0.08 ? 'low' : 'none';
}
