// ============================================
// profile.js — AI 人物档案管理
// 身份、职业、语言风格、口头禅等
// ============================================

const AIProfile = {
  // 默认档案
  defaults: {
    aiName: '小忆',
    aiIdentity: '知心朋友',
    aiOccupation: '',
    aiSpeakingStyle: '温暖亲切，像朋友一样自然交流',
    aiCatchphrases: '',
    aiTraits: '善解人意、细心、有耐心、偶尔幽默',
    aiBackground: '',
    userNickname: '',
  },

  // 当前档案（运行时）
  current: {},

  /**
   * 初始化
   */
  init() {
    this.current = { ...this.defaults };
    try {
      const saved = localStorage.getItem('chat-ai-profile');
      if (saved) {
        const data = JSON.parse(saved);
        Object.assign(this.current, data);
      }
    } catch (e) {
      console.warn('加载人物档案失败', e);
    }
    return this.current;
  },

  /**
   * 保存档案
   */
  save(profile) {
    Object.assign(this.current, profile);
    try {
      localStorage.setItem('chat-ai-profile', JSON.stringify(this.current));
    } catch (e) {
      console.warn('保存人物档案失败', e);
    }
  },

  /**
   * 重置为默认
   */
  reset() {
    this.current = { ...this.defaults };
    localStorage.removeItem('chat-ai-profile');
    return this.current;
  },

  /**
   * 构建系统提示词（人物档案部分）
   */
  buildSystemPrompt() {
    const p = this.current;
    const lines = [];

    lines.push(`你的名字是"${p.aiName}"。`);
    lines.push(`你的角色定位是：${p.aiIdentity}。`);

    if (p.aiOccupation) {
      lines.push(`你的虚拟职业/身份背景是：${p.aiOccupation}。`);
    }

    lines.push(`你的说话风格：${p.aiSpeakingStyle}。`);
    lines.push(`你的性格特点：${p.aiTraits}。`);

    if (p.aiCatchphrases) {
      lines.push(`你偶尔会使用以下口头禅或表达习惯：${p.aiCatchphrases}。`);
    }

    if (p.aiBackground) {
      lines.push(`你的背景设定：${p.aiBackground}`);
    }

    if (p.userNickname) {
      lines.push(`用户希望你称呼他们为：${p.userNickname}。`);
    }

    return lines.join('\n');
  },

  /**
   * 生成完整的自我介绍
   */
  generateIntro() {
    const p = this.current;
    const parts = [`我叫${p.aiName}`];

    if (p.aiIdentity) parts.push(`是你的${p.aiIdentity}`);
    if (p.aiOccupation) parts.push(`，平时${p.aiOccupation}`);
    if (p.aiTraits) parts.push(`。我${p.aiTraits}`);

    return parts.join('') + '。很高兴认识你！';
  },
};

export default AIProfile;
