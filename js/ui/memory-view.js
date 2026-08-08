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
      const daysAgo = Math.floor((Date.now() - fact.createdAt) / 86400000);
      const ageText = daysAgo === 0 ? '今天' : daysAgo === 1 ? '昨天' : `${daysAgo}天前`;

      const card = Render.el('div', 'memory-card', {
        'data-fact-id': fact.id,
        onclick: () => this._toggleDetail(card, fact),
      }, [
        Render.el('div', 'mem-content', { text: fact.fact }),
        Render.el('div', 'mem-meta', {}, [
          Render.el('span', 'mem-category', { text: `${catInfo.icon} ${catInfo.label}` }),
          Render.el('span', '', { text: `⭐ ${fact.importance.toFixed(1)}` }),
          Render.el('span', '', { text: ageText }),
          fact.accessCount > 0 ? Render.el('span', '', { text: `🔄 ${fact.accessCount}次` }) : null,
        ]),
        Render.el('div', 'mem-detail hidden', {}, [
          Render.el('div', 'mem-detail-info', {}, [
            Render.el('p', '', { text: `创建：${new Date(fact.createdAt).toLocaleString('zh-CN')}` }),
            Render.el('p', '', { text: `最近访问：${new Date(fact.lastAccessedAt).toLocaleString('zh-CN')}` }),
            fact.sourceConvId ? Render.el('button', 'btn-primary', {
              text: '💬 查看源对话',
              style: 'margin-top:8px; font-size:12px; padding:6px 12px;',
              onclick: async (e) => {
                e.stopPropagation();
                await this._jumpToConversation(fact.sourceConvId);
              },
            }) : null,
          ]),
        ]),
        Render.el('div', 'mem-actions', {}, [
          Render.el('button', '', {
            text: '🗑 删除',
            onclick: async (e) => {
              e.stopPropagation();
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
   * 切换记忆详情展开/折叠
   */
  _toggleDetail(card, fact) {
    const detail = card.querySelector('.mem-detail');
    if (!detail) return;

    const isHidden = detail.classList.contains('hidden');
    // 关闭所有其他展开的详情
    document.querySelectorAll('.mem-detail:not(.hidden)').forEach(d => {
      if (d !== detail) d.classList.add('hidden');
    });

    if (isHidden) {
      detail.classList.remove('hidden');
      Facts.touch(fact.id); // 更新访问记录
    } else {
      detail.classList.add('hidden');
    }
  },

  /**
   * 跳转到记忆的源对话
   */
  async _jumpToConversation(convId) {
    // 切换到聊天Tab
    document.querySelector('[data-tab="chat"]')?.click();

    // 打开对应对话
    const { default: ChatView } = await import('./chat-view.js');
    await ChatView.openChat(convId);
    Toast.info('已跳转到源对话');
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
