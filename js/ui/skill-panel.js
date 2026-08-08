// ============================================
// skill-panel.js — 技能面板 UI
// ============================================

import Render from './render.js';
import Toast from './toast.js';
import Registry from '../skills/registry.js';

const SkillPanel = {
  /**
   * 初始化技能面板
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;
    this.render();
  },

  /**
   * 渲染技能卡片网格
   */
  render() {
    const grid = Render.$('#skill-grid');
    const skills = Registry.list();
    const categories = {
      communication: { label: '沟通辅助' },
      companion: { label: 'AI 陪伴' },
      utility: { label: '实用工具' },
    };

    Render.empty(grid);

    for (const [catKey, catInfo] of Object.entries(categories)) {
      const catSkills = skills.filter(s => s.category === catKey);
      if (catSkills.length === 0) continue;

      for (const skill of catSkills) {
        const isActive = Registry.isActive(skill.id);
        const card = Render.el('div', `skill-card ${isActive ? 'active' : ''}`, {
          'data-skill-id': skill.id,
          onclick: () => this.toggleSkill(skill.id),
        }, [
          Render.el('div', 'skill-icon', { text: skill.icon }),
          Render.el('div', 'skill-name', { text: skill.name }),
          Render.el('div', 'skill-desc', { text: skill.description }),
          Render.el('div', 'skill-category', { text: catInfo.label }),
          isActive ? Render.el('div', 'skill-badge', { text: '已激活' }) : null,
        ]);
        grid.appendChild(card);
      }
    }
  },

  /**
   * 切换技能激活状态
   */
  toggleSkill(skillId) {
    const activated = Registry.toggle(skillId);

    // 更新卡片状态
    const card = document.querySelector(`[data-skill-id="${skillId}"]`);
    if (card) {
      if (activated) {
        card.classList.add('active');
        // 添加激活标记
        let badge = card.querySelector('.skill-badge');
        if (!badge) {
          badge = Render.el('div', 'skill-badge', { text: '已激活' });
          card.appendChild(badge);
        }
        Toast.success(`已激活：${Registry.get(skillId).name}`);
      } else {
        card.classList.remove('active');
        const badge = card.querySelector('.skill-badge');
        if (badge) badge.remove();
        Toast.info(`已停用：${Registry.get(skillId).name}`);
      }
    }

    // 更新聊天输入区的技能标签
    this._updateChatChips();
  },

  /**
   * 更新聊天输入区的激活技能标签
   */
  _updateChatChips() {
    const container = Render.$('#active-skills');
    if (!container) return;
    Render.empty(container);

    for (const skill of Registry.getActive()) {
      const chip = Render.el('span', 'skill-chip', {}, [
        `${skill.icon} ${skill.name}`,
        Render.el('span', 'chip-close', {
          text: '×',
          onclick: (e) => {
            e.stopPropagation();
            Registry.deactivate(skill.id);
            this._updateChatChips();
            this.render();
          },
        }),
      ]);
      container.appendChild(chip);
    }
  },
};

export default SkillPanel;
