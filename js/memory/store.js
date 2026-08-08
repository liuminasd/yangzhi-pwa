// ============================================
// store.js — IndexedDB 封装层
// 统一管理所有数据存储
// ============================================

const DB_NAME = 'chat-ai-assistant';
const DB_VERSION = 2;

class Store {
  constructor() {
    this.db = null;
  }

  /**
   * 打开/初始化数据库
   */
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // 对话表
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          convStore.createIndex('pinned', 'pinned', { unique: false });
        }

        // 消息表
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('conversationId', 'conversationId', { unique: false });
          msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 记忆事实表
        if (!db.objectStoreNames.contains('facts')) {
          const factStore = db.createObjectStore('facts', { keyPath: 'id' });
          factStore.createIndex('category', 'category', { unique: false });
          factStore.createIndex('createdAt', 'createdAt', { unique: false });
          factStore.createIndex('importance', 'importance', { unique: false });
        }

        // 用户配置表（键值对）
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'key' });
        }

        // v2: 附件表（图片/OCR）
        if (!db.objectStoreNames.contains('attachments')) {
          const attStore = db.createObjectStore('attachments', { keyPath: 'id' });
          attStore.createIndex('conversationId', 'conversationId', { unique: false });
          attStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        // 处理版本变更（多标签页场景）：关闭旧连接，让其他标签页完成升级
        this.db.onversionchange = () => {
          this.db.close();
          this.db = null;
          console.warn('IndexedDB 版本变更，连接已关闭，请刷新页面');
        };
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB 打开失败', e);
        reject(e);
      };
    });
  }

  /**
   * 通用：添加记录
   */
  async add(storeName, item) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.add(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 通用：更新记录
   */
  async put(storeName, item) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 通用：获取单条记录
   */
  async get(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 通用：获取所有记录（按索引排序）
   */
  async getAll(storeName, indexName, direction = 'prev') {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = indexName ? store.index(indexName) : null;
      const results = [];
      const request = (index || store).openCursor(null, direction);

      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 通用：按索引查询
   */
  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const results = [];
      const request = index.openCursor(IDBKeyRange.only(value));

      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 通用：删除记录
   */
  async delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 通用：清空表
   */
  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 在事务中执行多对象存储操作（保证原子性）
   */
  async execInTransaction(storeNames, callback) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeNames, 'readwrite');
      const stores = {};
      for (const name of storeNames) {
        stores[name] = tx.objectStore(name);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
      try {
        callback(stores, tx);
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * 通用：计数
   */
  async count(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取数据库大小估算
   */
  async getStorageEstimate() {
    try {
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          total: estimate.quota || 0,
          usedFormatted: this._formatBytes(estimate.usage || 0),
          totalFormatted: this._formatBytes(estimate.quota || 0),
        };
      }
    } catch (e) {
      console.warn('存储估算失败', e);
    }
    return null;
  }

  _formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}

// 单例
const DB = new Store();
export default DB;
