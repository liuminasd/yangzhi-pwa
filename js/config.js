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
        Object.assign(this, data);
        if (data.memory) Object.assign(this.memory, data.memory);
        if (data.chat) Object.assign(this.chat, data.chat);
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
