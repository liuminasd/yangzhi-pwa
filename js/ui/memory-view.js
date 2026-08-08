// ============================================
// memory-view.js — 记忆管理界面
// ============================================

import Render from './render.js';
import Toast from './toast.js';
import Facts from '../memory/facts.js';
import Security from '../utils/security.js';

const MemoryView = {
  /**
   * 初始化记忆界面
   */
  async init() {
    Render.$('#memory-search-input').addEventListener('input',
      Render.debounce(() => this.search(), 300)
    );
    await this.load();
  },

  /**
   * 加载记忆列表
   */
  async load(query = '') {
    await this.renderStats();
    await this.renderList(query);
  },

  /**
   * 渲染统计信息
   */
  async renderStats() {
    const stats = await Facts.stats();
    const container = Render.$('#memory-stats');

    let html = `共 <strong>${stats.total}</strong> 条记忆`;
    if (stats.byCategory) {
      const parts = [];
      for (const [cat, count] of Object.entries(stats.byCategory)) {
        const catInfo = Facts.CATEGORIES[cat];
        if (catInfo) {
          parts.push(`${catInfo.icon} ${catInfo.label}：${count}`);
        }
      }
      if (parts.length > 0) {
        html += ` &nbsp;|&nbsp; ${parts.join(' &nbsp; ')}`;
      }
    }
    container.innerHTML = html;
  },

  /**
   * 渲染记忆列表
   */
  async renderList(query = '') {
    const container = Render.$('#memory-list');
    const facts = await Facts.search(query, 50);

    if (facts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧠</div>
          <p>${query ? '没有找到相关记忆' : '还没有记忆<br>多和我聊天，我会记住关于你的事 💭'}</p>
        </div>`;
      return;
    }

    Render.empty(container);

    for (const fact of facts) {
      const catInfo = Facts.CATEGORIES[fact.category] || Facts.CATEGORIES.other;
      const card = Render.el('div', 'memory-card', {}, [
        Render.el('div', 'mem-content', { text: fact.fact }),
        Render.el('div', 'mem-meta', {}, [
          Render.el('span', 'mem-category', { text: `${catInfo.icon} ${catInfo.label}` }),
          Render.el('span', '', { text: `⭐ ${fact.importance.toFixed(1)}` }),
          Render.el('span', '', { text: Security.formatTime(fact.createdAt) }),
        ]),
        Render.el('div', 'mem-actions', {}, [
          Render.el('button', '', {
            text: '🗑 删除',
            onclick: async () => {
              await Facts.remove(fact.id);
              Toast.success('记忆已删除');
              await this.load(query);
            },
          }),
        ]),
      ]);
      container.appendChild(card);
    }
  },

  /**
   * 搜索记忆
   */
  async search() {
    const query = Render.$('#memory-search-input').value.trim();
    await this.renderList(query);
  },
};

export default MemoryView;
