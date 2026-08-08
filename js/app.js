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
import AIProfile from './profile.js';
import ProfileSync from './profile-sync.js';
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
    const DEBUG = false; // 生产环境关闭调试日志
    const log = (...args) => DEBUG && console.log(...args);

    try {
      // 1. 加载配置
      Config.load();

      // 2. 初始化人物档案 + 同步
      AIProfile.init();
      ProfileSync.init();

      // 2b. 尝试从服务器拉取最新档案（后台静默）
      ProfileSync.autoPullOnStart().then(result => {
        if (result) log('远程档案同步成功');
      });

      // 3. 应用主题
      this.applyTheme();

      // 4. 初始化数据库
      await DB.open();
      log('IndexedDB 初始化完成');

      // 5. 执行记忆衰减维护
      if (Config.memory.decayDays > 0) {
        Facts.decayMaintenance(Config.memory.decayDays).then(removed => {
          if (removed > 0) log(`记忆衰减清理了 ${removed} 条旧记忆`);
        });
      }

      // 6. 检查 API Key — 无 Key 则显示强制配置页面
      if (!Config.isReady()) {
        this.showSetupOverlay();
        return; // 停止后续初始化，等用户配置完
      }

      // 7. 初始化 UI 模块
      await this.initUI();

      // 8. 绑定 Tab 导航
      this.bindNavigation();

      // 9. 更新连接状态
      this.updateConnectionStatus();

      log('AI 聊天伴侣 初始化完成');
    } catch (error) {
      console.error('初始化失败', error && error.message || error);
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
  /**
   * 显示首次配置向导（无 API Key 时强制显示）
   */
  showSetupOverlay() {
    // 隐藏正常 UI
    document.getElementById('top-bar').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'none';
    document.getElementById('main-content').style.display = 'none';

    // 创建配置向导
    const overlay = document.createElement('div');
    overlay.id = 'setup-overlay';
    overlay.innerHTML = `
      <div id="setup-card">
        <div class="setup-icon">🔑</div>
        <h1>欢迎使用 AI 聊天伴侣</h1>
        <p>在开始之前，请配置 DeepSeek API Key</p>
        <div class="setup-steps">
          📌 <strong>如何获取 API Key？</strong><br>
          1️⃣ 访问 <a href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com</a><br>
          2️⃣ 注册/登录 DeepSeek 账号<br>
          3️⃣ 创建 API Key 并复制到这里
        </div>
        <input type="password" id="setup-api-key" placeholder="粘贴你的 DeepSeek API Key (sk-...)" autocomplete="off">
        <div class="setup-error" id="setup-error"></div>
        <button class="btn-primary" id="btn-setup-save" style="width:100%;margin-bottom:8px;">
          ✅ 保存并开始使用
        </button>
        <button class="btn-primary" id="btn-setup-test" style="width:100%;background:var(--bg-hover);">
          🔍 先测试连接
        </button>
        <div class="setup-hint">
          🔒 密钥仅保存在你的浏览器中，不会上传到任何服务器
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 绑定事件
    const apiKeyInput = document.getElementById('setup-api-key');
    const errorEl = document.getElementById('setup-error');

    const saveAndContinue = async () => {
      const key = apiKeyInput.value.trim();
      if (!key) {
        errorEl.textContent = '请输入 API Key';
        return;
      }
      if (!key.startsWith('sk-')) {
        errorEl.textContent = 'API Key 格式不正确（应以 sk- 开头）';
        return;
      }

      Config.apiKey = key;
      Config.save();

      // 移除向导
      overlay.remove();
      document.getElementById('top-bar').style.display = '';
      document.getElementById('bottom-nav').style.display = '';
      document.getElementById('main-content').style.display = '';

      Toast.success('API Key 已保存！');
      // 继续初始化
      await this.continueInit();
    };

    document.getElementById('btn-setup-save').addEventListener('click', saveAndContinue);
    apiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveAndContinue();
    });

    document.getElementById('btn-setup-test').addEventListener('click', async () => {
      const key = apiKeyInput.value.trim();
      if (!key) {
        errorEl.textContent = '请先输入 API Key';
        return;
      }
      errorEl.textContent = '⏳ 测试中...';
      try {
        const resp = await fetch(`${Config.apiBase}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: Config.model,
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
        if (resp.ok) {
          errorEl.textContent = '';
          Toast.success('✅ 连接成功！点击保存开始使用');
        } else if (resp.status === 401 || resp.status === 403) {
          errorEl.textContent = '❌ API Key 无效，请检查';
        } else {
          const err = await resp.text().catch(() => '');
          errorEl.textContent = `❌ 连接失败 (${resp.status})`;
        }
      } catch (e) {
        errorEl.textContent = `❌ 网络错误：${e.message}`;
      }
    });

    // 自动聚焦输入框
    setTimeout(() => apiKeyInput.focus(), 300);
  },

  /**
   * 配置完 API Key 后继续初始化
   */
  async continueInit() {
    await this.initUI();
    this.bindNavigation();
    this.updateConnectionStatus();

    // 打开一个欢迎对话
    const { default: ChatView } = await import('./ui/chat-view.js');
    await ChatView.newChat();
  },

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
