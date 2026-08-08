// ============================================
// config.js — 全局配置管理
// ============================================

const Config = {
  // API 配置（用户可在设置中修改）
  apiKey: '',
  apiBase: 'https://api.deepseek.com/anthropic',
  model: 'deepseek-v4-pro',
  fastModel: 'deepseek-v4-flash',
  maxTokens: 4096,
  temperature: 0.7,

  // 记忆配置
  memory: {
    autoExtract: true,           // 是否自动提取记忆
    extractThreshold: 10,        // 对话轮数阈值，触发提取
    maxInjectFacts: 15,          // 每次注入最多事实数
    decayDays: 30,               // 记忆衰减天数
  },

  // 对话配置
  chat: {
    maxHistoryRounds: 20,        // 保留最近N轮对话
    compressThreshold: 30,       // 超过此消息数触发压缩
    streamResponse: true,        // 流式响应
  },

  // 主题
  theme: 'dark',                 // dark | light | auto

  // 初始化：从 localStorage 加载
  load() {
    try {
      const saved = localStorage.getItem('chat-ai-config');
      if (saved) {
        const data = JSON.parse(saved);
        // 白名单方式恢复字段，防止恶意 JSON 覆写方法
        if (typeof data.apiKey === 'string') this.apiKey = data.apiKey;
        if (typeof data.apiBase === 'string') this.apiBase = data.apiBase;
        if (typeof data.model === 'string') this.model = data.model;
        if (typeof data.fastModel === 'string') this.fastModel = data.fastModel;
        if (typeof data.maxTokens === 'number') this.maxTokens = data.maxTokens;
        if (typeof data.temperature === 'number') this.temperature = data.temperature;
        if (typeof data.theme === 'string') this.theme = data.theme;
        if (data.memory && typeof data.memory === 'object') {
          if (typeof data.memory.autoExtract === 'boolean') this.memory.autoExtract = data.memory.autoExtract;
          if (typeof data.memory.extractThreshold === 'number') this.memory.extractThreshold = data.memory.extractThreshold;
          if (typeof data.memory.maxInjectFacts === 'number') this.memory.maxInjectFacts = data.memory.maxInjectFacts;
          if (typeof data.memory.decayDays === 'number') this.memory.decayDays = data.memory.decayDays;
        }
        if (data.chat && typeof data.chat === 'object') {
          if (typeof data.chat.maxHistoryRounds === 'number') this.chat.maxHistoryRounds = data.chat.maxHistoryRounds;
          if (typeof data.chat.compressThreshold === 'number') this.chat.compressThreshold = data.chat.compressThreshold;
          if (typeof data.chat.streamResponse === 'boolean') this.chat.streamResponse = data.chat.streamResponse;
        }
      }
    } catch (e) {
      console.warn('加载配置失败，使用默认值', e);
    }
  },

  // 保存到 localStorage
  save() {
    try {
      localStorage.setItem('chat-ai-config', JSON.stringify({
        apiKey: this.apiKey,
        apiBase: this.apiBase,
        model: this.model,
        fastModel: this.fastModel,
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        memory: this.memory,
        chat: this.chat,
        theme: this.theme,
      }));
    } catch (e) {
      console.warn('保存配置失败', e);
    }
  },

  // 是否已配置 API Key
  isReady() {
    return !!this.apiKey;
  },
};

export default Config;
