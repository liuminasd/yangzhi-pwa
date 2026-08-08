// ============================================
// ocr.js — 截图识别引擎
// Tesseract.js v5 懒加载 + 粘贴/上传处理
// ============================================

import Toast from './toast.js';

const OCR = {
  _worker: null,
  _loading: false,
  _pendingFile: null,
  _onProgress: null,
  _onComplete: null,

  /**
   * 初始化 OCR 模块
   * @param {Object} callbacks - { onProgress, onComplete, onError }
   */
  init(callbacks = {}) {
    this._onProgress = callbacks.onProgress || (() => {});
    this._onComplete = callbacks.onComplete || (() => {});
    this._onError = callbacks.onError || ((msg) => Toast.error(msg));

    this._bindPaste();
    this._bindUpload();
  },

  /**
   * 处理图片文件（上传或粘贴），长截图自动触发发言方识别
   */
  async processImage(file) {
    if (!file || !file.type.startsWith('image/')) return;

    this._pendingFile = file;
    this._showPreview(file);

    try {
      // 检测是否为长截图（高宽比 > 2.5）
      const isLongScreenshot = await this._isLongImage(file);

      if (isLongScreenshot) {
        this._onProgress('检测到长截图，正在识别文字...');
      }

      const result = await this.recognize(file);

      if (result.text) {
        this._onComplete(result.text, file, isLongScreenshot);
      } else {
        Toast.info('未识别到文字，图片将作为附件发送');
        this._onComplete('', file, false);
      }
    } catch (e) {
      console.warn('OCR 识别失败', e);
      Toast.info('OCR 识别失败，图片将作为附件发送');
      this._onComplete('', file, false);
    } finally {
      this._hideProgress();
    }
  },

  /**
   * 检测是否为长截图（高宽比 > 2.5）
   */
  async _isLongImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img.naturalHeight / img.naturalWidth > 2.5);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(false);
      };
      img.src = url;
    });
  },

  /**
   * 识别图片文字
   */
  async recognize(file) {
    this._showProgress();
    const worker = await this._ensureWorker();

    const imageDataUrl = await this._fileToDataUrl(file);
    const { data } = await worker.recognize(imageDataUrl);
    return { text: data.text.trim(), confidence: Math.round(data.confidence) };
  },

  /**
   * 获取当前待发送的文件
   */
  getPendingFile() {
    return this._pendingFile;
  },

  /**
   * 清除预览和待发送文件
   */
  clearPreview() {
    this._pendingFile = null;
    const preview = document.getElementById('image-preview');
    if (preview) preview.classList.add('hidden');
    const img = document.getElementById('preview-img');
    if (img) img.src = '';
    this._hideProgress();
  },

  /**
   * 懒加载 Tesseract Worker
   */
  async _ensureWorker() {
    if (this._worker) return this._worker;
    if (this._loading) {
      // 等待正在进行的加载（最长60秒）
      return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
          if (this._worker) resolve(this._worker);
          else if (Date.now() - start > 60000) reject(new Error('OCR引擎加载超时'));
          else setTimeout(check, 200);
        };
        check();
      });
    }

    this._loading = true;
    this._onProgress('正在加载OCR引擎...');

    try {
      const Tesseract = await import(
        'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js'
      );

      this._worker = await Tesseract.createWorker('chi_sim+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            this._onProgress(`识别中 ${pct}%...`);
          }
        },
      });
      return this._worker;
    } catch (e) {
      this._loading = false;
      throw new Error('OCR引擎加载失败，请检查网络连接');
    } finally {
      this._loading = false;
    }
  },

  /**
   * 绑定全局粘贴事件
   */
  _bindPaste() {
    document.addEventListener('paste', (e) => {
      // 仅当聊天窗口可见时处理
      const chatWindow = document.getElementById('chat-window');
      if (!chatWindow || chatWindow.classList.contains('hidden')) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          this.processImage(item.getAsFile());
          return;
        }
      }
    });
  },

  /**
   * 绑定上传按钮
   */
  _bindUpload() {
    const btn = document.getElementById('btn-attach-image');
    const input = document.getElementById('image-file-input');

    if (btn && input) {
      btn.addEventListener('click', () => input.click());
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.processImage(file);
        input.value = '';
      });
    }

    // 清除预览按钮
    const clearBtn = document.getElementById('btn-clear-preview');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearPreview());
    }
  },

  /**
   * 显示图片预览
   */
  _showPreview(file) {
    const preview = document.getElementById('image-preview');
    const img = document.getElementById('preview-img');
    if (!preview || !img) return;

    preview.classList.remove('hidden');
    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result;
    };
    reader.onerror = () => {
      console.warn('图片预览读取失败');
      preview.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  },

  /**
   * 显示OCR进度
   */
  _showProgress() {
    const progress = document.getElementById('ocr-progress');
    if (progress) progress.classList.remove('hidden');
  },

  /**
   * 隐藏OCR进度
   */
  _hideProgress() {
    const progress = document.getElementById('ocr-progress');
    if (progress) progress.classList.add('hidden');
  },

  /**
   * File → base64 DataURL
   */
  _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  },
};

export default OCR;
