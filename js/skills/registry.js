// ============================================
// registry.js — 技能注册中心
// 管理所有技能的注册、激活、触发
// ============================================

class SkillRegistry {
  constructor() {
    this.skills = new Map();       // id → skill 实例
    this.activeIds = new Set();    // 当前激活的技能 ID
    this.triggers = new Map();     // 触发词 → [skillId]
  }

  /**
   * 注册技能
   */
  register(skill) {
    this.skills.set(skill.id, skill);

    // 建立触发词索引
    if (skill.triggers && skill.triggers.length > 0) {
      for (const trigger of skill.triggers) {
        if (!this.triggers.has(trigger)) {
          this.triggers.set(trigger, []);
        }
        this.triggers.get(trigger).push(skill.id);
      }
    }
  }

  /**
   * 批量注册
   */
  registerAll(skills) {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * 获取技能
   */
  get(id) {
    return this.skills.get(id);
  }

  /**
   * 列出所有技能
   */
  list(category = null) {
    const all = [...this.skills.values()];
    if (category) {
      return all.filter(s => s.category === category);
    }
    return all;
  }

  /**
   * 获取已激活的技能列表
   */
  getActive() {
    return [...this.activeIds].map(id => this.skills.get(id)).filter(Boolean);
  }

  /**
   * 激活技能
   */
  activate(id) {
    if (this.skills.has(id)) {
      this.activeIds.add(id);
      return true;
    }
    return false;
  }

  /**
   * 停用技能
   */
  deactivate(id) {
    this.activeIds.delete(id);
  }

  /**
   * 切换激活状态
   */
  toggle(id) {
    if (this.activeIds.has(id)) {
      this.deactivate(id);
      return false;
    } else {
      return this.activate(id);
    }
  }

  /**
   * 检查是否激活
   */
  isActive(id) {
    return this.activeIds.has(id);
  }

  /**
   * 从用户消息中检测触发词，返回匹配的技能列表
   */
  detectTriggers(message) {
    const matched = new Set();
    const lowerMsg = message.toLowerCase();

    for (const [trigger, skillIds] of this.triggers) {
      if (lowerMsg.includes(trigger.toLowerCase())) {
        for (const id of skillIds) {
          matched.add(id);
        }
      }
    }
    return [...matched];
  }

  /**
   * 构建所有激活技能的系统提示词
   */
  buildSystemPrompt() {
    const prompts = [];
    for (const id of this.activeIds) {
      const skill = this.skills.get(id);
      if (skill && skill.systemPrompt) {
        prompts.push(skill.systemPrompt);
      }
    }
    return prompts.join('\n\n');
  }

  /**
   * 预处理用户输入（所有激活技能的 preprocess 链）
   */
  async preprocess(userInput) {
    let result = userInput;
    for (const id of this.activeIds) {
      const skill = this.skills.get(id);
      if (skill && skill.preprocess) {
        result = await skill.preprocess(result);
      }
    }
    return result;
  }
}

// 单例
const Registry = new SkillRegistry();
export default Registry;
