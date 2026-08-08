// ============================================
// app.js — 应用入口，初始化所有模块
// ============================================

// Polyfill: Array.prototype.findLastIndex
if (!Array.prototype.findLastIndex) {
  Array.prototype.findLastIndex = function(predicate) {
    for (let i = this.length - 1; i >= 0; i--) {
      if (predicate(this[i], i, this)) return i;
    }
    return -1;
  };
}

import Config from './config.js';
import DB from './memory/store.js';
import Facts from './memory/facts.js';
import Conversations from './memory/conversations.js';
import ChatView from './ui/chat-view.js';
import SkillPanel from './ui/skill-panel.js';
import MemoryView from './ui/memory-view.js';
import SettingsPanel from './ui/settings.js';
import Toast from './ui/toast.js';

// 全局事件总线
window.App = {
  events: new EventTarget(),
};

const App = {
  async init() {
    try {
      // 1. 加载配置
      Config.load();

      // 2. 应用主题
      this.applyTheme();

      // 3. 初始化数据库
      await DB.open();
      console.log('IndexedDB 初始化完成');

      // 4. 执行记忆衰减维护
      if (Config.memory.decayDays > 0) {
        Facts.decayMaintenance(Config.memory.decayDays).then(removed => {
          if (removed > 0) console.log(`记忆衰减清理了 ${removed} 条旧记忆`);
        });
      }

      // 5. 初始化 UI 模块
      await this.initUI();

      // 6. 绑定 Tab 导航
      this.bindNavigation();

      // 7. 检查 API Key
      if (!Config.isReady()) {
        // 首次使用，引导到设置页
        setTimeout(() => {
          document.querySelector('[data-tab="settings"]')?.click();
          Toast.info('👋 欢迎！请先在设置中配置 API Key');
        }, 500);
      }

      // 8. 更新连接状态
      this.updateConnectionStatus();

      console.log('AI 聊天伴侣 初始化完成');
    } catch (error) {
      console.error('初始化失败', error);
      Toast.error('应用初始化失败，请刷新页面');
    }
  },

  /**
   * 初始化 UI 模块
   */
  async initUI() {
    // 聊天界面
    await ChatView.init();

    // 技能面板
    SkillPanel.init();

    // 记忆界面
    await MemoryView.init();

    // 设置页面
    SettingsPanel.init();
  },

  /**
   * 绑定底部导航
   */
  bindNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabPages = document.querySelectorAll('.tab-page');

    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;

        // 更新按钮状态
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 切换页面
        tabPages.forEach(page => {
          page.classList.toggle('active', page.id === `tab-${tabName}`);
        });

        // 更新顶部标题
        const titles = {
          chat: 'AI 聊天伴侣',
          skills: '技能中心',
          memory: '我的记忆',
          settings: '设置',
        };
        document.getElementById('top-title').textContent = titles[tabName] || 'AI 聊天伴侣';

        // 切换到对应Tab时自动刷新
        if (tabName === 'memory') {
          MemoryView.load();
        } else if (tabName === 'skills') {
          SkillPanel.render();
        } else if (tabName === 'settings') {
          SettingsPanel.updateStorageInfo();
        }
      });
    });
  },

  /**
   * 应用主题
   */
  applyTheme() {
    if (Config.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      // 监听系统主题变化
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (Config.theme === 'auto') {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      });
    } else {
      document.documentElement.setAttribute('data-theme', Config.theme);
    }
  },

  /**
   * 更新连接状态指示器
   */
  updateConnectionStatus() {
    const dot = document.getElementById('connection-dot');
    const update = () => {
      const online = navigator.onLine;
      dot.className = online ? 'dot-online' : 'dot-offline';
      dot.title = online ? '在线' : '离线';
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
  },
};

// === 启动应用 ===
document.addEventListener('DOMContentLoaded', () => App.init());

// === 注册 Service Worker（PWA） ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(e => {
      console.log('Service Worker 注册失败（开发环境正常）', e);
    });
  });
}

export default App;
