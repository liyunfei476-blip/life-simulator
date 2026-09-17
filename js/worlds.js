// ===== 世界模板定义 =====
// 每个世界：主成长属性 + 阶段阶梯 + 专属属性 + 天赋池 + 氛围元素 + AI 提示词片段
const WORLDS = [
  {
    id: 'xiuxian',
    name: '修仙世界',
    emoji: '⛰️',
    themeColor: '#8a6cff',
    ornament: '仙 途 漫 漫 · 逆 天 改 命',
    bgGlow: 'rgba(138, 108, 255, .14)',
    panelMotif: '☁',
    description: '灵气充沛、宗门林立、妖兽横行的世界。凡人可凭灵根踏上仙途，逆天改命。',
    talents: [
      { name: '天灵根', desc: '天生灵根极佳，修炼事半功倍', effects: { 灵根: 30 } },
      { name: '家学渊源', desc: '出身修真世家，入门即有底子', effects: { 修为: 25, 功法: 2 } },
      { name: '坚韧不拔', desc: '意志如铁，体魄远超常人', effects: { 生命: 25, 心情: 10 } },
      { name: '福星高照', desc: '气运加身，常有意外之喜', effects: { 气运: 25 } },
      { name: '囊中丰厚', desc: '带着一笔不小的积蓄穿越', effects: { 财富: 150, 丹药: 3 } }
    ],
    mainAttr: { key: '修为', label: '修为', initial: 0, desc: '修炼进度，达标即可冲击下一境界' },
    stages: [
      { name: '凡人', require: 0 },
      { name: '炼气期', require: 30 },
      { name: '筑基期', require: 120 },
      { name: '金丹期', require: 400 },
      { name: '元婴期', require: 1000 },
      { name: '化神期', require: 2500 },
      { name: '炼虚期', require: 6000 },
      { name: '合体期', require: 14000 },
      { name: '大乘期', require: 30000 },
      { name: '渡劫期', require: 60000 },
      { name: '飞升成仙', require: 120000 }
    ],
    customAttrs: [
      { key: '灵根', label: '灵根', initial: 40, desc: '天赋资质，影响修炼效率与突破成功率' },
      { key: '寿元', label: '寿元', initial: 100, desc: '剩余寿命，境界提升可增加' },
      { key: '丹药', label: '丹药', initial: 0, desc: '辅助修炼与疗伤的丹药储备' },
      { key: '功法', label: '功法', initial: 0, desc: '所修功法的品阶' }
    ],
    features: ['境界突破', '渡劫', '炼丹', '宗门'],
    openingPrompt: '这是一方修仙世界：宗门林立、妖兽横行、弱肉强食。主角意外穿越至此，觉醒灵根，需在残酷的修真界中求存、修炼、突破、渡劫，最终踏上长生飞升之路。'
  },
  {
    id: 'history',
    name: '古代历史',
    emoji: '🏯',
    themeColor: '#c8a24a',
    ornament: '庙 堂 江 湖 · 王 侯 将 相',
    bgGlow: 'rgba(200, 162, 74, .13)',
    panelMotif: '龍',
    description: '王朝兴衰、庙堂权谋、边关烽火。穿越者或可凭才学入仕，或可乱世称雄。',
    talents: [
      { name: '将门虎子', desc: '出身将门，自幼习武', effects: { 武力: 30, 生命: 10 } },
      { name: '书香门第', desc: '家学深厚，才思敏捷', effects: { 智力: 25, 家族: 10 } },
      { name: '商贾世家', desc: '家财万贯，善于经营', effects: { 财富: 250 } },
      { name: '仁心仁德', desc: '乐善好施，深得人心', effects: { 民心: 25, 声望: 15 } },
      { name: '过目不忘', desc: '记忆力超群，科举有望', effects: { 智力: 15, 官职: 15 } }
    ],
    mainAttr: { key: '官职', label: '官职', initial: 0, desc: '仕途进度，决定你的政治地位' },
    stages: [
      { name: '平民', require: 0 },
      { name: '书生', require: 20 },
      { name: '举人', require: 80 },
      { name: '进士', require: 200 },
      { name: '县令', require: 500 },
      { name: '知府', require: 1200 },
      { name: '尚书', require: 3000 },
      { name: '宰相', require: 7000 },
      { name: '摄政', require: 15000 },
      { name: '皇帝', require: 30000 }
    ],
    customAttrs: [
      { key: '武力', label: '武力', initial: 20, desc: '个人勇武，影响战斗与兵事' },
      { key: '智力', label: '智力', initial: 40, desc: '谋略才学，影响仕途与决策' },
      { key: '家族', label: '家族', initial: 0, desc: '家族势力与声望' },
      { key: '民心', label: '民心', initial: 0, desc: '百姓对你的拥戴程度' }
    ],
    features: ['仕途', '战争', '政斗', '科举'],
    openingPrompt: '这是一个古代王朝：皇权至上、庙堂权谋、边关战乱。主角穿越至此，可凭才学科举入仕、执掌一方，或于乱世之中招兵买马、逐鹿天下。'
  },
  {
    id: 'wuxia',
    name: '武侠世界',
    emoji: '🗡️',
    themeColor: '#4aa8c8',
    ornament: '仗 剑 江 湖 · 快 意 恩 仇',
    bgGlow: 'rgba(74, 168, 200, .13)',
    panelMotif: '劍',
    description: '快意恩仇的江湖，正邪两立、门派纷争。习武之人以实力论高下。',
    talents: [
      { name: '武学奇才', desc: '根骨奇佳，悟性惊人', effects: { 内力: 30, 招式: 10 } },
      { name: '名门之后', desc: '出身名门正派，自带声望', effects: { 门派: 20, 江湖声望: 20 } },
      { name: '神兵认主', desc: '偶得一把绝世好剑', effects: { 兵器: 25 } },
      { name: '医者仁心', desc: '略通医理，行走江湖多条命', effects: { 生命: 30, 声望: 10 } },
      { name: '轻功绝世', desc: '来去如风，保命一流', effects: { 气运: 20, 内力: 15 } }
    ],
    mainAttr: { key: '内力', label: '内力', initial: 0, desc: '武学修为，决定江湖地位' },
    stages: [
      { name: '不入流', require: 0 },
      { name: '三流高手', require: 30 },
      { name: '二流高手', require: 120 },
      { name: '一流高手', require: 400 },
      { name: '绝顶高手', require: 1000 },
      { name: '宗师', require: 2500 },
      { name: '大宗师', require: 6000 }
    ],
    customAttrs: [
      { key: '招式', label: '招式', initial: 0, desc: '所会武学招式的精妙程度' },
      { key: '江湖声望', label: '江湖声望', initial: 0, desc: '在武林中的名望' },
      { key: '门派', label: '门派', initial: 0, desc: '所属门派或势力地位' },
      { key: '兵器', label: '兵器', initial: 0, desc: '所用兵器的品级' }
    ],
    features: ['江湖恩怨', '武功对决', '门派'],
    openingPrompt: '这是一个快意恩仇的武侠世界：江湖正邪两立、门派林立、恩怨情仇交织。主角穿越至此，习武修心，或行侠仗义、或称霸武林。'
  },
  {
    id: 'wasteland',
    name: '末世废土',
    emoji: '☢️',
    themeColor: '#b06a3a',
    ornament: '废 土 求 生 · 绝 境 逢 生',
    bgGlow: 'rgba(176, 106, 58, .13)',
    panelMotif: '☣',
    description: '灾变后的废土，资源匮乏、变异横行。活下去，是第一要务。',
    talents: [
      { name: '荒野猎手', desc: '身手矫健，擅长狩猎', effects: { 战斗力: 25 } },
      { name: '机械师', desc: '精通废土机械改装', effects: { 科技: 25, 生存物资: 20 } },
      { name: '铁人', desc: '对辐射有天然抗性', effects: { 生命: 30, 感染度: -20 } },
      { name: '领袖气质', desc: '天生让人愿意追随', effects: { 营地规模: 15, 势力: 10 } },
      { name: '囤货狂', desc: '穿越时带着大量物资', effects: { 生存物资: 60 } }
    ],
    mainAttr: { key: '生存物资', label: '生存物资', initial: 50, desc: '生存所需的水、食物与物资储备' },
    stages: [
      { name: '幸存者', require: 0 },
      { name: '拾荒者', require: 40 },
      { name: '小队长', require: 150 },
      { name: '营地首领', require: 500 },
      { name: '军阀', require: 1500 },
      { name: '救世主', require: 4000 }
    ],
    customAttrs: [
      { key: '战斗力', label: '战斗力', initial: 10, desc: '在废土中自保与掠夺的能力' },
      { key: '感染度', label: '感染度', initial: 0, desc: '变异感染程度，过高会致命' },
      { key: '营地规模', label: '营地规模', initial: 0, desc: '你所掌控的幸存者营地大小' },
      { key: '科技', label: '科技', initial: 0, desc: '废土科技与装备水平' }
    ],
    features: ['生存压力', '资源争夺', '变异'],
    openingPrompt: '这是一个灾变后的末世废土：文明崩塌、资源匮乏、变异生物横行。主角穿越至此，为生存而战，在绝境中建立营地、寻找希望。'
  },
  {
    id: 'scifi',
    name: '星际科幻',
    emoji: '🚀',
    themeColor: '#4a7cc8',
    ornament: '星 海 争 霸 · 执 掌 群 星',
    bgGlow: 'rgba(74, 124, 200, .14)',
    panelMotif: '✦',
    description: '群星争霸的银河时代，舰队与科技决定一切。弱者沦为尘埃，强者执掌星海。',
    talents: [
      { name: '天才工程师', desc: '对科技有惊人直觉', effects: { 科技点: 30 } },
      { name: '舰队世家', desc: '出身军方世家', effects: { 舰队规模: 20, 势力: 10 } },
      { name: '商业头脑', desc: '精于星际贸易', effects: { 信用点: 200, 财富: 100 } },
      { name: '外交官', desc: '长袖善舞，人脉广阔', effects: { 声望: 20, 势力: 15 } },
      { name: '幸运儿', desc: '总能在危机中全身而退', effects: { 气运: 25 } }
    ],
    mainAttr: { key: '科技点', label: '科技点', initial: 0, desc: '掌握的科技水平，决定发展上限' },
    stages: [
      { name: '平民', require: 0 },
      { name: '商人', require: 30 },
      { name: '舰长', require: 120 },
      { name: '星区总督', require: 400 },
      { name: '帝国元帅', require: 1200 },
      { name: '银河霸主', require: 3500 }
    ],
    customAttrs: [
      { key: '舰队规模', label: '舰队规模', initial: 0, desc: '所掌控的星际舰队实力' },
      { key: '星球控制', label: '星球控制', initial: 0, desc: '控制的星球数量与资源' },
      { key: '势力', label: '势力', initial: 0, desc: '在银河中的政治与军事影响力' },
      { key: '信用点', label: '信用点', initial: 0, desc: '星际通用货币' }
    ],
    features: ['星际争霸', '科技树', '舰队'],
    openingPrompt: '这是一个群星争霸的科幻时代：银河列强林立、舰队纵横、科技决定命运。主角穿越至此，或经商致富、或执掌舰队，于星海之中崛起。'
  },
  {
    id: 'magic',
    name: '西幻魔法',
    emoji: '🔮',
    themeColor: '#8a5cc8',
    ornament: '奥 术 永 恒 · 诸 神 注 视',
    bgGlow: 'rgba(138, 92, 200, .14)',
    panelMotif: '✧',
    description: '剑与魔法的奇幻大陆，诸神注视、种族纷争。魔法的奥义等待探索。',
    talents: [
      { name: '元素亲和', desc: '天生与魔法元素共鸣', effects: { 魔力: 30, 法术: 10 } },
      { name: '古老血统', desc: '流淌着稀有种族的血脉', effects: { 种族: 25, 生命: 10 } },
      { name: '虔诚之心', desc: '深受神明眷顾', effects: { 信仰: 30 } },
      { name: '炼金学徒', desc: '带着一包珍贵材料穿越', effects: { 魔法材料: 25, 财富: 80 } },
      { name: '命运眷顾', desc: '运气总是好得出奇', effects: { 气运: 25 } }
    ],
    mainAttr: { key: '魔力', label: '魔力', initial: 0, desc: '魔法修为，决定法师等阶' },
    stages: [
      { name: '学徒', require: 0 },
      { name: '见习法师', require: 30 },
      { name: '法师', require: 120 },
      { name: '大法师', require: 400 },
      { name: '魔导师', require: 1000 },
      { name: '法圣', require: 2500 },
      { name: '法神', require: 6000 }
    ],
    customAttrs: [
      { key: '法术', label: '法术', initial: 0, desc: '掌握的法术数量与威力' },
      { key: '种族', label: '种族', initial: 0, desc: '当前种族/血统的契合度' },
      { key: '信仰', label: '信仰', initial: 0, desc: '对神明的信仰，影响神术与庇护' },
      { key: '魔法材料', label: '魔法材料', initial: 0, desc: '施法与炼金所需材料' }
    ],
    features: ['魔法', '神系', '种族'],
    openingPrompt: '这是一个剑与魔法的奇幻大陆：诸神注视、种族纷争、魔法奥义深邃。主角穿越至此，探索魔法真谛，或成为传奇法师、或搅动大陆风云。'
  }
];

// 按 id 查找世界
function getWorld(id) {
  return WORLDS.find(w => w.id === id) || WORLDS[0];
}
