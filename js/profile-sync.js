// ============================================
// profile-sync.js — 人物档案同步到服务器
// 支持：导出上传 / 远程拉取 / 定时同步
// ============================================

import AIProfile from './profile.js';
import Config from './config.js';

const ProfileSync = {
  // 远程档案 URL（可在设置中配置）
  remoteURL: '',

  /**
   * 初始化：加载远程URL
   */
  init() {
    try {
      const saved = localStorage.getItem('chat-ai-profile-sync');
      if (saved) {
        const data = JSON.parse(saved);
        this.remoteURL = data.remoteURL || '';
      }
    } catch {}
  },

  /**
   * 设置远程同步URL
   */
  setRemoteURL(url) {
    this.remoteURL = url;
    try {
      const saved = localStorage.getItem('chat-ai-profile-sync');
      const data = saved ? JSON.parse(saved) : {};
      localStorage.setItem('chat-ai-profile-sync', JSON.stringify({
        ...data,
        remoteURL: url,
      }));
    } catch (e) {
      console.warn('保存同步URL失败（存储可能已满）', e);
    }
  },

  /**
   * 导出档案为 JSON 文件（供手动上传到服务器）
   */
  exportForServer() {
    try {
      const data = {
        type: 'ai-profile',
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: AIProfile.current,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-profile-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return data;
    } catch (e) {
      console.error('导出档案失败', e);
      throw e;
    }
  },

  /**
   * 从远程 URL 拉取档案
   * 使用时调用，自动合并到本地
   */
  async pullFromServer(url = null) {
    const targetURL = url || this.remoteURL;
    if (!targetURL) {
      throw new Error('未配置远程档案 URL，请先在设置中填写');
    }

    try {
      const resp = await fetch(targetURL, {
        signal: AbortSignal.timeout(10000),
        headers: { 'Accept': 'application/json' },
      });

      if (!resp.ok) {
        throw new Error(`服务器返回 ${resp.status}`);
      }

      const data = await resp.json();

      // 验证格式
      if (!data.type || data.type !== 'ai-profile') {
        throw new Error('无效的档案格式（缺少 type: ai-profile）');
      }
      if (!data.profile || !data.profile.aiName) {
        throw new Error('档案数据不完整');
      }

      // 合并到本地（远程优先，但保留本地独有字段）
      const merged = { ...AIProfile.current, ...data.profile };
      AIProfile.save(merged);

      // 记录同步时间
      try {
        localStorage.setItem('chat-ai-profile-sync', JSON.stringify({
          remoteURL: this.remoteURL,
          lastSync: Date.now(),
        }));
      } catch (e) {
        console.warn('保存同步时间失败（存储可能已满）', e);
      }

      return {
        success: true,
        profile: merged,
        exportedAt: data.exportedAt,
      };
    } catch (e) {
      throw new Error(`同步失败：${e.message}`);
    }
  },

  /**
   * 启动时自动拉取远程档案（静默，失败不提示）
   */
  async autoPullOnStart() {
    if (!this.remoteURL) return null;
    try {
      return await this.pullFromServer();
    } catch {
      // 静默失败，使用本地档案
      return null;
    }
  },

  /**
   * 获取最近同步时间
   */
  getLastSyncTime() {
    try {
      const saved = localStorage.getItem('chat-ai-profile-sync');
      if (saved) {
        const data = JSON.parse(saved);
        return data.lastSync || null;
      }
    } catch {}
    return null;
  },
};

export default ProfileSync;
