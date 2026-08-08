// ============================================
// settings.js — 设置页面
// ============================================

import Render from './render.js';
import Toast from './toast.js';
import Config from '../config.js';
import Facts from '../memory/facts.js';
import DB from '../memory/store.js';
import MemoryBridge from '../memory/memory-bridge.js';

const SettingsPanel = {
  /**
   * 初始化设置页面
   */
  init() {
    this.render();
  },

  /**
   * 渲染设置表单
   */
  render() {
    const container = Render.$('#settings-content');
    container.innerHTML = `
      <!-- API 设置 -->
      <div class="setting-group">
        <h3>🔑 API 配置</h3>
        <div class="setting-item full-width">
          <label>API Key</label>
          <input type="password" id="cfg-api-key" value="${Config.apiKey || ''}"
                 placeholder="输入 DeepSeek API Key">
          <span class="setting-hint">密钥仅存储在本地浏览器中</span>
        </div>
        <div class="setting-item full-width">
          <label>API Base URL</label>
          <input type="url" id="cfg-api-base" value="${Config.apiBase}"
                 placeholder="https://api.deepseek.com/anthropic">
        </div>
        <div class="setting-item">
          <label>模型</label>
          <select id="cfg-model">
            <option value="deepseek-v4-pro" ${Config.model === 'deepseek-v4-pro' ? 'selected' : ''}>deepseek-v4-pro（推荐）</option>
            <option value="deepseek-v4-flash" ${Config.model === 'deepseek-v4-flash' ? 'selected' : ''}>deepseek-v4-flash（快速）</option>
          </select>
        </div>
        <div class="setting-item">
          <button class="btn-primary" id="btn-save-api">💾 保存设置</button>
          <button class="btn-primary" id="btn-test-api" style="background:var(--bg-hover);">🔍 测试连接</button>
        </div>
      </div>

      <!-- 记忆设置 -->
      <div class="setting-group">
        <h3>🧠 记忆设置</h3>
        <div class="setting-item">
          <div>
            <label>自动提取记忆</label>
            <div class="setting-hint">AI 自动从对话中学习并记住你的信息</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="cfg-auto-extract" ${Config.memory.autoExtract ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-item">
          <label>记忆提取频率</label>
          <select id="cfg-extract-threshold">
            <option value="5" ${Config.memory.extractThreshold === 5 ? 'selected' : ''}>每5轮对话</option>
            <option value="10" ${Config.memory.extractThreshold === 10 ? 'selected' : ''}>每10轮对话</option>
            <option value="20" ${Config.memory.extractThreshold === 20 ? 'selected' : ''}>每20轮对话</option>
          </select>
        </div>
        <div class="setting-item">
          <label>记忆衰减天数</label>
          <select id="cfg-decay-days">
            <option value="15" ${Config.memory.decayDays === 15 ? 'selected' : ''}>15天</option>
            <option value="30" ${Config.memory.decayDays === 30 ? 'selected' : ''}>30天</option>
            <option value="60" ${Config.memory.decayDays === 60 ? 'selected' : ''}>60天</option>
            <option value="0" ${Config.memory.decayDays === 0 ? 'selected' : ''}>不衰减</option>
          </select>
        </div>
      </div>

      <!-- 主题设置 -->
      <div class="setting-group">
        <h3>🎨 外观</h3>
        <div class="setting-item">
          <label>主题</label>
          <select id="cfg-theme">
            <option value="dark" ${Config.theme === 'dark' ? 'selected' : ''}>深色模式</option>
            <option value="light" ${Config.theme === 'light' ? 'selected' : ''}>浅色模式</option>
            <option value="auto" ${Config.theme === 'auto' ? 'selected' : ''}>跟随系统</option>
          </select>
        </div>
      </div>

      <!-- 数据管理 -->
      <div class="setting-group">
        <h3>💾 数据管理</h3>
        <div class="setting-item">
          <button class="btn-primary" id="btn-export">📤 导出数据</button>
          <button class="btn-primary" id="btn-import" style="background:var(--bg-hover);">📥 导入数据</button>
        </div>
        <div class="setting-item">
          <button class="btn-danger" id="btn-clear-all">🗑 清除所有数据</button>
        </div>
        <div class="setting-item">
          <span class="setting-hint" id="storage-info">加载中...</span>
        </div>
      </div>

      <!-- ChromaDB 桥接 -->
      <div class="setting-group">
        <h3>🔗 claude-mem 桥接</h3>
        <div class="setting-item">
          <button class="btn-primary" id="btn-check-chroma" style="background:var(--bg-hover);">🔍 检查 ChromaDB</button>
          <button class="btn-primary" id="btn-sync-chroma" style="background:var(--bg-hover);">🔄 同步到 ChromaDB</button>
        </div>
        <span class="setting-hint" id="chroma-status"></span>
      </div>

      <input type="file" id="import-file" accept=".json" style="display:none">
    `;

    this.bindEvents();
    this.updateStorageInfo();
  },

  /**
   * 绑定设置事件
   */
  bindEvents() {
    // 保存设置
    Render.$('#btn-save-api').addEventListener('click', () => {
      Config.apiKey = Render.$('#cfg-api-key').value.trim();
      Config.apiBase = Render.$('#cfg-api-base').value.trim() || 'https://api.deepseek.com/anthropic';
      Config.model = Render.$('#cfg-model').value;
      Config.memory.autoExtract = Render.$('#cfg-auto-extract').checked;
      Config.memory.extractThreshold = parseInt(Render.$('#cfg-extract-threshold').value);
      Config.memory.decayDays = parseInt(Render.$('#cfg-decay-days').value);
      Config.theme = Render.$('#cfg-theme').value;
      Config.save();
      this.applyTheme();
      Toast.success('设置已保存');
    });

    // 测试连接
    Render.$('#btn-test-api').addEventListener('click', async () => {
      const key = Render.$('#cfg-api-key').value.trim();
      if (!key) {
        Toast.error('请先输入 API Key');
        return;
      }
      Toast.info('测试中...');
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
            max_tokens: 10,
            messages: [{ role: 'user', content: '你好' }],
          }),
        });
        if (resp.ok) {
          Toast.success('连接成功！');
        } else {
          const err = await resp.text();
          Toast.error(`连接失败：${resp.status}`);
        }
      } catch (e) {
        Toast.error(`连接失败：${e.message}`);
      }
    });

    // 导出数据
    Render.$('#btn-export').addEventListener('click', async () => {
      try {
        const allConvs = await DB.getAll('conversations');
        const allMsgs = await DB.getAll('messages');
        const allFacts = await DB.getAll('facts');
        const data = {
          version: 1,
          exportedAt: new Date().toISOString(),
          conversations: allConvs,
          messages: allMsgs,
          facts: allFacts,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-ai-backup-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        Toast.success('数据已导出');
      } catch (e) {
        Toast.error(`导出失败：${e.message}`);
      }
    });

    // 导入数据
    Render.$('#btn-import').addEventListener('click', () => {
      Render.$('#import-file').click();
    });
    Render.$('#import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.version) throw new Error('无效的数据格式');

        if (!confirm(`即将导入 ${data.conversations?.length || 0} 个对话、${data.messages?.length || 0} 条消息、${data.facts?.length || 0} 条记忆。\n\n当前数据将被覆盖，确定继续？`)) return;

        // 清空现有数据
        await DB.clear('conversations');
        await DB.clear('messages');
        await DB.clear('facts');

        // 批量导入
        for (const conv of data.conversations || []) await DB.add('conversations', conv);
        for (const msg of data.messages || []) await DB.add('messages', msg);
        for (const fact of data.facts || []) await DB.add('facts', fact);

        Toast.success('数据导入成功！请刷新页面');
      } catch (e) {
        Toast.error(`导入失败：${e.message}`);
      }
      e.target.value = '';
    });

    // 清除所有数据
    Render.$('#btn-clear-all').addEventListener('click', async () => {
      if (!confirm('⚠️ 确定清除所有数据？\n\n这将删除所有对话、消息和记忆。此操作不可撤销！')) return;
      if (!confirm('再次确认：清除所有数据？')) return;

      await DB.clear('conversations');
      await DB.clear('messages');
      await DB.clear('facts');
      localStorage.removeItem('chat-ai-config');
      Toast.success('所有数据已清除。请刷新页面。');
    });

    // ChromaDB 桥接
    Render.$('#btn-check-chroma').addEventListener('click', async () => {
      const statusEl = Render.$('#chroma-status');
      statusEl.textContent = '检查中...';
      const available = await MemoryBridge.checkAvailability();
      statusEl.textContent = available ? '✅ ChromaDB 可用' : '❌ ChromaDB 不可用（claude-mem worker 未运行）';
    });

    Render.$('#btn-sync-chroma').addEventListener('click', async () => {
      const statusEl = Render.$('#chroma-status');
      statusEl.textContent = '同步中...';
      const result = await MemoryBridge.syncAll();
      if (result.error) {
        statusEl.textContent = `❌ 同步失败：${result.error}`;
      } else {
        statusEl.textContent = `✅ 已同步 ${result.synced} 条记忆`;
      }
    });
  },

  /**
   * 应用主题
   */
  applyTheme() {
    if (Config.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', Config.theme);
    }
  },

  /**
   * 更新存储信息
   */
  async updateStorageInfo() {
    const info = await DB.getStorageEstimate();
    if (info) {
      const el = Render.$('#storage-info');
      if (el) el.textContent = `已使用 ${info.usedFormatted} / ${info.totalFormatted}`;
    }
  },
};

export default SettingsPanel;
