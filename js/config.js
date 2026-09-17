// ===== 全局配置与常量 =====
const CONFIG = {
  // 默认模型（DeepSeek，玩家只需填 Key）
  defaultModel: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    apiKey: ''
  },

  // 模型预设：baseURL 与模型均已预设好，玩家只需填 API Key
  // 若模型有更新，可点设置面板中的「获取模型列表」自动拉取最新可用模型
  modelPresets: [
    {
      name: 'DeepSeek（推荐·便宜）',
      baseURL: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      keyUrl: 'https://platform.deepseek.com/api_keys',
      note: '性价比最高，剧情质量足够好'
    },
    {
      name: 'DeepSeek（旗舰）',
      baseURL: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      keyUrl: 'https://platform.deepseek.com/api_keys',
      note: '效果更强，价格略高'
    },
    {
      name: '智谱 GLM',
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-5.3-flash',
      keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
      note: '模型可用性与费用以服务商账号为准'
    },
    {
      name: '通义千问',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
      keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
      note: '阿里云百炼平台，需开通对应模型并检查账号额度'
    },
    {
      name: 'Kimi',
      baseURL: 'https://api.moonshot.cn/v1',
      model: 'kimi-k2-turbo-preview',
      keyUrl: 'https://platform.moonshot.cn/console/api-keys',
      note: '长上下文表现好'
    },
    {
      name: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      keyUrl: 'https://platform.openai.com/api-keys',
      note: '需海外网络环境'
    },
    {
      name: '自定义（手动填写）',
      baseURL: '',
      model: '',
      keyUrl: '',
      note: '任意 OpenAI 兼容接口均可'
    }
  ],

  // 游戏常量
  START_AGE: 16,        // 起始年龄
  MAX_AGE: 100,         // 自然寿命上限（通用）
  MAX_TURNS: 1000,      // 每段人生的回合上限
  MAX_HISTORY: 16,      // 保留给 AI 的最近对话条数（越小越快）

  // 通用属性初始值
  baseAttributes: {
    hp: 100,
    maxHp: 100,
    age: 16,
    wealth: 0,
    reputation: 0,
    influence: 0,
    luck: 50,
    mood: 50
  },

  // 温度等采样参数
  temperature: 0.9,
  maxTokens: 2000
};
