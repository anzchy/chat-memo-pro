/**
 * Chat Memo - Genspark平台适配器
 * 继承BasePlatformAdapter，实现Genspark平台特定的逻辑
 *
 * 特点：使用多层fallback选择器策略查找消息元素
 */

class GensparkAdapter extends BasePlatformAdapter {
  constructor() {
    super('genspark');
  }

  /**
   * 验证是否为有效的Genspark对话URL
   * @param {string} url - 要验证的URL
   * @returns {boolean} - 是否为有效的对话URL
   */
  isValidConversationUrl(url) {
    return /^https:\/\/www\.genspark\.ai\/agents\?id=/.test(url);
  }

  /**
   * 从URL中提取对话ID
   * @param {string} url - 要分析的URL
   * @returns {Object} - 包含conversationId和isNewConversation的对象
   */
  extractConversationInfo(url) {
    try {
      const urlObj = new URL(url);
      const conversationId = urlObj.searchParams.get('id');

      return {
        conversationId: conversationId ? `genspark_${conversationId}` : null,
        isNewConversation: false
      };
    } catch (error) {
      console.error('Keep AI Memory (Genspark): URL解析失败:', error);
      return {
        conversationId: null,
        isNewConversation: false
      };
    }
  }

  /**
   * 提取页面上的所有消息
   * 使用fallback selector策略
   * @returns {Array} - 消息数组
   */
  extractMessages() {
    const messages = [];

    // 查找对话容器
    const container = document.querySelector('main') ||
                     document.querySelector('[role="main"]') ||
                     document.querySelector('.conversation-container');

    if (!container) {
      console.log('Keep AI Memory (Genspark): 未找到对话容器');
      return messages;
    }

    // 策略：使用多层fallback选择器
    // 按优先级尝试不同的选择器策略
    const messageSelectors = [
      '[class*="message"]',
      '[class*="chat"]',
      '[class*="conversation"]',
      'div[class*="flex"]',
      'div > div'
    ];

    let messageElements = [];
    let usedSelector = '';

    for (const selector of messageSelectors) {
      messageElements = container.querySelectorAll(selector);
      if (messageElements.length > 0) {
        usedSelector = selector;
        console.log(`Keep AI Memory (Genspark): 使用选择器 "${selector}" 找到 ${messageElements.length} 个元素`);
        break;
      }
    }

    if (messageElements.length === 0) {
      console.log('Keep AI Memory (Genspark): 未找到任何消息元素');
      return messages;
    }

    // 提取消息内容
    messageElements.forEach((element) => {
      const text = element.innerText?.trim();
      if (!text || text.length < 5) return;

      // 判断消息角色（基于布局和class）
      let role = 'assistant'; // 默认AI响应

      const classNames = element.className || '';
      const style = window.getComputedStyle(element);

      // 用户消息通常右对齐或包含特定class
      if (classNames.includes('user') ||
          classNames.includes('query') ||
          style.textAlign === 'right' ||
          style.justifyContent === 'flex-end') {
        role = 'user';
      }

      // AI消息通常左对齐或包含特定class
      if (classNames.includes('assistant') ||
          classNames.includes('response') ||
          classNames.includes('ai')) {
        role = 'assistant';
      }

      messages.push({
        role: role,
        content: text,
        timestamp: Date.now()
      });
    });

    console.log(`Keep AI Memory (Genspark): 提取到 ${messages.length} 条消息`);
    return messages;
  }

  /**
   * 检查元素是否为消息元素
   * @param {Node} node - 要检查的DOM节点
   * @returns {boolean} - 是否为消息元素
   */
  isMessageElement(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    const classNames = node.className || '';

    // 检查是否包含消息相关class
    return classNames.includes('message') ||
           classNames.includes('chat') ||
           classNames.includes('user') ||
           classNames.includes('assistant') ||
           classNames.includes('response');
  }

  /**
   * 提取标题
   * @returns {string} - 提取的标题
   */
  extractTitle() {
    // 尝试从页面标题提取
    const title = document.title;
    if (title && !title.includes('Genspark')) {
      return title;
    }

    // 尝试从页面中查找标题元素
    const titleElement = document.querySelector('h1') ||
                        document.querySelector('[class*="title"]');
    if (titleElement) {
      return titleElement.innerText.trim();
    }

    return 'Genspark Conversation';
  }
}

// 初始化
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const adapter = new GensparkAdapter();
    adapter.init();
  });
}
