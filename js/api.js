// ============================================
// api.js — DeepSeek API 封装（Anthropic 兼容格式）
// 支持流式响应、重试、中断
// ============================================

import Config from './config.js';
import TokenEstimator from './utils/token.js';

class ApiClient {
  constructor() {
    this.abortController = null;
  }

  /**
   * 发送消息到 DeepSeek API
   * @param {Array} messages - [{role, content}, ...]
   * @param {Object} options - {model, maxTokens, temperature, stream, signal}
   */
  async sendMessage(messages, options = {}) {
    const {
      model = Config.model,
      maxTokens = Config.maxTokens,
      temperature = Config.temperature,
      stream = Config.chat.streamResponse,
    } = options;

    if (!Config.apiKey) {
      throw new Error('请先在设置中配置 API Key');
    }

    this.abortController = new AbortController();

    // 分离系统消息和对话消息（Anthropic 格式）
    const systemMessages = messages.filter(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model,
      max_tokens: maxTokens,
      temperature,
      stream,
      messages: this._formatMessages(chatMessages),
    };

    // 如果有系统消息，放到顶层 system 参数
    if (systemMessages.length > 0) {
      body.system = systemMessages.map(m => m.content).join('\n\n');
    }

    const response = await this._fetch('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new ApiError(response.status, errText);
    }

    if (stream) {
      return this._handleStream(response);
    }
    return response.json();
  }

  /**
   * 流式生成器
   */
  async *_handleStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));
            const event = this._parseStreamEvent(data);

            if (event.type === 'delta' && event.text) {
              yield { type: 'delta', text: event.text };
            } else if (event.type === 'stop') {
              yield { type: 'stop', usage: event.usage };
            } else if (event.type === 'error') {
              yield { type: 'error', error: event.error };
            }
          } catch (e) {
            // 跳过无法解析的行
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 解析 SSE 事件类型
   */
  _parseStreamEvent(event) {
    switch (event.type) {
      case 'content_block_delta':
        return { type: 'delta', text: event.delta?.text || '' };
      case 'content_block_start':
        return { type: 'block_start', block: event.content_block };
      case 'content_block_stop':
        return { type: 'block_stop' };
      case 'message_delta':
        return { type: 'message_delta', delta: event.delta, usage: event.usage };
      case 'message_stop':
        return { type: 'stop', usage: event?.usage || event?.['anthropic-beta']?.usage };
      case 'error':
        return { type: 'error', error: event.error?.message || '未知错误' };
      default:
        return { type: 'meta', event };
    }
  }

  /**
   * 中断当前请求
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * 格式化消息（确保系统提示词在第一条）
   */
  _formatMessages(messages) {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * 带重试的 fetch
   */
  async _fetch(url, options, retries = 3) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          'x-api-key': Config.apiKey,
          'anthropic-version': '2023-06-01',
          ...options.headers,
        };

        // 合并超时信号（60秒超时）
        const timeoutSignal = AbortSignal.timeout(60000);
        let signal = timeoutSignal;
        if (options.signal) {
          // AbortSignal.any() 兼容性处理（Firefox 135+, Safari 17+）
          signal = typeof AbortSignal.any === 'function'
            ? AbortSignal.any([options.signal, timeoutSignal])
            : options.signal; // 降级：只响应用户中断，不设超时
        }

        return await fetch(`${Config.apiBase}${url}`, {
          ...options,
          headers,
          signal,
        });
      } catch (error) {
        lastError = error;
        if (attempt === retries) break;
        if (error.name === 'AbortError') throw error;

        // 指数退避
        const delay = Math.pow(2, attempt) * 500;
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError;
  }
}

/**
 * API 错误类
 */
class ApiError extends Error {
  constructor(status, body) {
    let message = `API 请求失败 (${status})`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.error?.message) {
        message = parsed.error.message;
      }
    } catch {}
    super(message);
    this.status = status;
    // 不暴露原始响应体，防止密钥等敏感信息泄露
    this.sanitizedBody = message;
  }
}

// 单例
const API = new ApiClient();
export { API as default, ApiError };
