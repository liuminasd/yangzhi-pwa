// ============================================
// auth.js — 手机号+密码登录验证
// 纯前端认证，PBKDF2 哈希，IndexedDB 存储
// ============================================

import DB from './memory/store.js';

const Auth = {
  SESSION_KEY: 'chat-ai-session',
  SESSION_DAYS: 7,
  PBKDF2_ITERATIONS: 310000,
  _currentUser: null,

  /**
   * 验证手机号格式（中国大陆）
   */
  validatePhone(phone) {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return '请输入正确的11位手机号';
    }
    return null; // null = 验证通过
  },

  /**
   * 验证密码格式
   */
  validatePassword(password) {
    if (!password || password.length < 6) {
      return '密码至少6位';
    }
    if (password.length > 32) {
      return '密码最多32位';
    }
    return null;
  },

  /**
   * 注册新用户
   * @returns {{phone, createdAt}}
   */
  async register(phone, password) {
    // 1. 检查是否已注册
    const existing = await DB.get('users', phone);
    if (existing) {
      throw new Error('该账号已注册，请直接登录');
    }

    // 2. 生成 salt 并哈希密码
    const salt = this._generateSalt();
    const passwordHash = await this._hashPassword(password, salt);

    // 3. 写入数据库
    const user = {
      phone,
      passwordHash,
      salt: this._toHex(salt),
      createdAt: Date.now(),
    };
    await DB.add('users', user);

    // 4. 设置当前用户 + session
    this._currentUser = { phone: user.phone, createdAt: user.createdAt };
    this._saveSession(user);

    return { phone: user.phone, createdAt: user.createdAt };
  },

  /**
   * 登录
   * @returns {{phone, createdAt}}
   */
  async login(phone, password) {
    // 1. 查找用户
    const user = await DB.get('users', phone);
    if (!user) {
      throw new Error('账号不存在，请先注册');
    }

    // 2. 验证密码
    const salt = this._fromHex(user.salt);
    const passwordHash = await this._hashPassword(password, salt);
    if (passwordHash !== user.passwordHash) {
      throw new Error('密码错误');
    }

    // 3. 设置当前用户 + session
    this._currentUser = { phone: user.phone, createdAt: user.createdAt };
    this._saveSession(user);

    return { phone: user.phone, createdAt: user.createdAt };
  },

  /**
   * 自动登录 — 检查 session token 是否有效
   * @returns {user | null}
   */
  async autoLogin() {
    try {
      const session = this._getSession();
      if (!session) return null;

      // 验证过期
      if (Date.now() > session.expires) {
        this._clearSession();
        return null;
      }

      // 验证用户存在
      const user = await DB.get('users', session.phone);
      if (!user) {
        this._clearSession();
        return null;
      }

      this._currentUser = { phone: user.phone, createdAt: user.createdAt };
      return this._currentUser;
    } catch {
      this._clearSession();
      return null;
    }
  },

  /**
   * 退出登录
   */
  logout() {
    this._clearSession();
    this._currentUser = null;
    window.location.reload();
  },

  /**
   * 获取当前登录用户
   */
  getCurrentUser() {
    return this._currentUser;
  },

  /**
   * 是否已登录
   */
  isLoggedIn() {
    return !!this._currentUser;
  },

  // ========== 内部方法 ==========

  /**
   * PBKDF2 哈希密码
   * @param {string} password
   * @param {Uint8Array} salt - 16 字节
   * @returns {string} hex 编码的 256-bit 哈希
   */
  async _hashPassword(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: this.PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    return this._toHex(new Uint8Array(derived));
  },

  /**
   * 生成随机 16 字节 salt
   */
  _generateSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
  },

  /**
   * 生成 session token
   */
  _generateToken() {
    if (crypto.randomUUID) return crypto.randomUUID();
    // Fallback for old browsers (consistent with Security.uuid)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  /**
   * 保存 session 到 localStorage
   */
  _saveSession(user) {
    const session = {
      token: this._generateToken(),
      phone: user.phone,
      expires: Date.now() + this.SESSION_DAYS * 24 * 60 * 60 * 1000,
    };
    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    } catch {
      // localStorage 不可用时静默失败
    }
  },

  /**
   * 清除 session
   */
  _clearSession() {
    try {
      localStorage.removeItem(this.SESSION_KEY);
    } catch {}
  },

  /**
   * 读取 session
   */
  _getSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Uint8Array → hex 字符串
   */
  _toHex(buffer) {
    return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * hex 字符串 → Uint8Array
   */
  _fromHex(hex) {
    if (!hex || hex.length % 2 !== 0) return new Uint8Array(0);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  },
};

export default Auth;
