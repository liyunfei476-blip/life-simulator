// ===== 数值引擎：确定性地管理属性、经济、战斗、晋升、结局 =====

// 通用属性中文别名 -> 标准键
const ATTR_ALIASES = {
  hp: 'hp', '生命': 'hp', '健康': 'hp', '血量': 'hp',
  maxHp: 'maxHp', '最大生命': 'maxHp',
  wealth: 'wealth', '财富': 'wealth', '金钱': 'wealth', '银两': 'wealth', '金币': 'wealth',
  reputation: 'reputation', '声望': 'reputation', '名声': 'reputation',
  influence: 'influence', '势力': 'influence', '权力': 'influence', '权势': 'influence',
  luck: 'luck', '气运': 'luck', '运气': 'luck', '机缘': 'luck',
  mood: 'mood', '心情': 'mood', '情绪': 'mood',
  age: 'age', '年龄': 'age', '岁数': 'age'
};

// 各世界用于战斗的实力来源
function getCombatPower(state) {
  const p = state.player;
  const w = getWorld(state.worldId);
  switch (w.id) {
    case 'xiuxian':   return p.main * 0.8 + (p.custom['灵根'] || 0) * 0.3;
    case 'history':   return (p.custom['武力'] || 0) * 1.5 + p.main * 0.3;
    case 'wuxia':     return p.main * 0.8 + (p.custom['招式'] || 0) * 0.5;
    case 'wasteland': return (p.custom['战斗力'] || 0) * 2 + p.main * 0.2;
    case 'scifi':     return (p.custom['舰队规模'] || 0) * 1.2 + p.main * 0.4;
    case 'magic':     return p.main * 0.8 + (p.custom['法术'] || 0) * 0.5;
    default:          return p.main + 10;
  }
}

// 创建初始游戏状态（talent 为所选天赋对象，可选）
function createInitialState(worldId, playerName, talent) {
  const world = getWorld(worldId);
  const base = CONFIG.baseAttributes;
  const custom = {};
  world.customAttrs.forEach(a => { custom[a.key] = a.initial; });

  const state = {
    worldId: world.id,
    player: {
      name: playerName || '无名氏',
      age: base.age,
      hp: base.hp,
      maxHp: base.maxHp,
      wealth: base.wealth,
      reputation: base.reputation,
      influence: base.influence,
      luck: base.luck,
      mood: base.mood,
      main: world.mainAttr.initial,   // 主成长属性
      stageIndex: 0,                   // 当前阶段
      custom: custom
    },
    talent: talent ? talent.name : null,  // 所选天赋
    flags: {},                         // 剧情标记
    adventure: Adventure.create(),
    calendarDays: 0,
    turn: 0,
    status: 'playing',                 // playing / ended
    ending: null,                      // 结局描述
    log: []                            // 局内事件日志（属性变化记录）
  };

  // 应用天赋加成
  if (talent && talent.effects) {
    state.player.maxHp += Math.max(0, Number(talent.effects['生命']) || 0);
    applyEffects(state, talent.effects);
  }

  return state;
}

// 定位某个属性在状态中的引用，返回 {obj, key} 或 null
function locateAttr(state, key) {
  const p = state.player;
  const w = getWorld(state.worldId);
  const k = String(key).trim();

  // 主成长属性
  if (k === w.mainAttr.key || k === w.mainAttr.label) return { obj: p, key: 'main' };

  // 专属属性
  for (const a of w.customAttrs) {
    if (k === a.key || k === a.label) return { obj: p.custom, key: a.key };
  }

  // 通用属性（含别名）
  const std = Object.prototype.hasOwnProperty.call(ATTR_ALIASES, k) ? ATTR_ALIASES[k] : null;
  if (std) return { obj: p, key: std };

  return null;
}

// 读取属性值
function getAttr(state, key) {
  const ref = locateAttr(state, key);
  return ref ? ref.obj[ref.key] : null;
}

// 应用 AI 返回的 effects（属性变化），返回变更摘要
function applyEffects(state, effects) {
  const changes = [];
  if (!effects || typeof effects !== 'object') return changes;

  for (const [rawKey, rawVal] of Object.entries(effects)) {
    const ref = locateAttr(state, rawKey);
    if (!ref) continue;
    if (typeof rawVal !== 'number' || !Number.isFinite(rawVal)) continue;
    const before = ref.obj[ref.key] || 0;
    const min = ['reputation', 'influence'].includes(ref.key) ? -1000000 : (ref.key === 'maxHp' ? 1 : 0);
    const max = ref.key === 'hp' ? state.player.maxHp :
      (['mood', 'luck', '感染度'].includes(ref.key) ? 100 : 1000000);
    ref.obj[ref.key] = Math.max(min, Math.min(max, Math.round(before + rawVal)));
    state.player.hp = Math.min(state.player.hp, state.player.maxHp);
    const actual = ref.obj[ref.key] - before;
    if (actual) changes.push(`${rawKey} ${actual >= 0 ? '+' : ''}${actual}`);
  }
  return changes;
}

function advanceTurn(state, days = 30) {
  if (!days) return;
  state.turn += 1;
  const elapsed = (state.calendarDays || 0) + days;
  state.player.age += Math.floor(elapsed / 365);
  state.calendarDays = elapsed % 365;
  state.player.mood = Math.max(0, state.player.mood - 1);
}

// 概率判定
function roll(chance) {
  return Math.random() * 100 < chance;
}

// ===== 生死裁决系统 =====
// 危险等级对应的基础致死率（%）
const DANGER_TABLE = {
  none:    { death: 0,  survive: 0,  twist: 0  },
  low:     { death: 3,  survive: 10, twist: 4  },
  medium:  { death: 12, survive: 25, twist: 8  },
  high:    { death: 35, survive: 30, twist: 12 },
  extreme: { death: 65, survive: 15, twist: 15 }
};

/**
 * 裁决一次危险事件的命运。
 * 返回 'safe' | 'survive'（重伤生还）| 'twist'（意外转折）| 'death'（身死道消）
 *
 * 设计要点：任何危险都不是必死，也不是必活。
 * - 气运高、生命充足、境界高 → 降低致死率
 * - 重伤状态下遇险 → 致死率显著上升
 */
function judgeFate(state, danger) {
  const level = Object.prototype.hasOwnProperty.call(DANGER_TABLE, danger) ? DANGER_TABLE[danger] : DANGER_TABLE.none;
  if (level === DANGER_TABLE.none) return 'safe';

  const p = state.player;
  const luckMod = Math.max(-15, Math.min(15, (p.luck - 50) * 0.3));
  // 生命状态：血量越低越危险，最多 +25%
  const hpRatio = p.hp / p.maxHp;
  const hpMod = hpRatio <= 0.25 ? 25 : (hpRatio <= 0.5 ? 10 : 0);
  // 境界修正：阶段越高越抗打，最多 -20%
  const stageMod = -Math.min(20, p.stageIndex * 2.5);

  let deathChance = level.death - luckMod + hpMod + stageMod;
  // 永不 100%（保留奇迹），也永不为 0（保留风险）
  deathChance = Math.max(1, Math.min(92, deathChance));

  if (roll(deathChance)) return 'death';

  // 未死，判定后果轻重
  const twistChance = level.twist + Math.max(0, luckMod);
  if (roll(twistChance)) return 'twist';
  if (roll(level.survive)) return 'survive';
  return 'safe';
}

// 应用「重伤生还」的代价
function applySurvivalCost(state) {
  const p = state.player;
  const loss = Math.max(1, Math.round(p.hp * (0.5 + Math.random() * 0.4)));
  p.hp = Math.max(1, p.hp - loss);        // 至少留 1 点，不因代价直接死
  p.mood = Math.max(0, p.mood - 15);
  return loss;
}

// 应用「意外转折」的收益
function applyTwistGain(state) {
  const p = state.player;
  const gains = [];
  p.hp = Math.max(p.hp, 1, Math.round(p.maxHp * 0.3));
  gains.push('生命至少恢复至三成');
  if (roll(50)) {
    const luckUp = 5 + Math.floor(Math.random() * 10);
    p.luck = Math.min(100, p.luck + luckUp);
    gains.push('气运 +' + luckUp);
  }
  if (roll(40)) {
    const mainUp = Math.max(1, Math.round(p.main * 0.1)) + 3;
    p.main += mainUp;
    gains.push(getWorld(state.worldId).mainAttr.label + ' +' + mainUp);
  }
  return gains;
}

// 战斗结算：敌人 { name, power }，返回 { victory, hpLoss }
function resolveCombat(state, enemy) {
  const myPower = getCombatPower(state);
  const enemyPower = Number(enemy.power) || 50;
  const diff = myPower - enemyPower;
  // 胜率映射到 5% ~ 95%
  const winChance = Math.max(5, Math.min(95, 50 + diff * 2));
  const victory = roll(winChance);
  const hpLoss = victory
    ? Math.round(5 + Math.random() * 15)
    : Math.round(25 + Math.random() * 35);
  state.player.hp = Math.max(0, state.player.hp - hpLoss);
  return { victory, hpLoss };
}

// 检查触发：死亡 / 晋升 / 巅峰结局。返回触发列表
function checkTriggers(state) {
  const triggers = [];
  const p = state.player;
  const w = getWorld(state.worldId);
  if (state.status !== 'playing') return triggers;

  // 死亡判定
  if (p.hp <= 0) {
    triggers.push({ type: 'death', reason: '伤势过重，生命垂危' });
    return triggers;
  }
  // 寿元/年龄
  const shouyuan = w.id === 'xiuxian' ? (p.custom['寿元'] ?? 100) : CONFIG.MAX_AGE;
  if (p.age >= shouyuan) {
    triggers.push({ type: 'death', reason: '寿元耗尽，寿终正寝' });
    return triggers;
  }
  // 末世感染度
  if (w.id === 'wasteland' && (p.custom['感染度'] || 0) >= 100) {
    triggers.push({ type: 'death', reason: '感染失控，化为变异体' });
    return triggers;
  }

  // 晋升判定：主属性达到下一阶段阈值
  const nextStage = w.stages[p.stageIndex + 1];
  if (nextStage && p.main >= nextStage.require) {
    triggers.push({ type: 'promotion', stage: nextStage, index: p.stageIndex + 1 });
  }

  // 巅峰结局：达到最高阶段
  if (p.stageIndex === w.stages.length - 1 && p.main >= w.stages[w.stages.length - 1].require) {
    triggers.push({ type: 'peak' });
  }

  return triggers;
}

// 执行晋升：提升阶段，并给予阶段奖励
function applyPromotion(state, newIndex) {
  const p = state.player;
  const w = getWorld(state.worldId);
  p.stageIndex = newIndex;
  // 阶段奖励：生命回满、心情提升
  p.hp = p.maxHp;
  p.mood = Math.min(100, p.mood + 20);
  // 修仙提升寿元
  if (w.id === 'xiuxian') {
    p.custom['寿元'] = (p.custom['寿元'] || 100) + 20;
  }
}

// 生成当前属性快照文本（用于 AI 提示）
function buildStatusText(state) {
  const p = state.player;
  const w = getWorld(state.worldId);
  const stage = w.stages[p.stageIndex];
  const parts = [
    `姓名:${p.name}`, `年龄:${p.age}`, `生命:${p.hp}/${p.maxHp}`,
    `财富:${p.wealth}`, `声望:${p.reputation}`, `势力:${p.influence}`,
    `气运:${p.luck}`, `心情:${p.mood}`
  ];
  parts.push(`${w.mainAttr.label}:${p.main}`, `当前境界/身份:${stage.name}`);
  w.customAttrs.forEach(a => { parts.push(`${a.label}:${p.custom[a.key]}`); });
  return parts.join('，');
}
