/**
 * Chat Memo - Genspark平台适配器
 * 继承BasePlatformAdapter，实现Genspark平台特定的逻辑
 *
 * 特点：使用多层fallback选择器策略查找消息元素
 */

class GensparkAdapter extends BasePlatformAdapter {
  /**
   * 构造函数
   */
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
   * 判断元素是否为消息元素
   * 使用精准选择器识别用户消息和AI消息
   * @param {HTMLElement} element - 要检查的DOM元素
   * @returns {boolean} - 是否为消息元素
   */
  isMessageElement(element) {
    if (!element || !element.matches) {
      return false;
    }

    // 用户消息
    if (element.matches('.conversation-statement.user')) {
      return true;
    }

    // AI消息
    if (element.matches('.conversation-statement.assistant')) {
      return true;
    }

    return false;
  }

  /**
   * 提取页面上的所有消息
   * 使用精准选择器区分用户和AI消息
   * @returns {Array} - 消息数组
   */
  extractMessages() {
    const messages = [];
    const processedElements = new Set(); // 避免重复处理

    // 精准选择器：用户消息
    const userMessageElements = document.querySelectorAll('.conversation-statement.user');

    // 精准选择器：AI消息
    const aiMessageElements = document.querySelectorAll('.conversation-statement.assistant');

    // 创建所有元素的数组并按DOM顺序排序
    const allElements = [];

    userMessageElements.forEach(el => {
      allElements.push({ element: el, role: 'user' });
    });

    aiMessageElements.forEach(el => {
      allElements.push({ element: el, role: 'assistant' });
    });

    if (allElements.length === 0) {
      console.log('Keep AI Memory (Genspark): 未找到任何消息元素');
      return messages;
    }

    // 按DOM中的位置排序（使用Node.compareDocumentPosition）
    allElements.sort((a, b) => {
      const position = a.element.compareDocumentPosition(b.element);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1; // a在b之前
      } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1; // a在b之后
      }
      return 0;
    });

    // 提取内容
    allElements.forEach(({ element, role }) => {
      if (processedElements.has(element)) {
        return; // 跳过已处理的元素
      }
      processedElements.add(element);

      let content = '';

      if (role === 'user') {
        // 用户消息：尝试多种选择器提取内容
        const codeElement = element.querySelector('.content pre code');
        if (codeElement) {
          content = codeElement.innerText.trim();
        } else {
          const contentDiv = element.querySelector('.content') || element;
          content = contentDiv.innerText.trim();
        }
      } else {
        // AI消息：提取markdown内容
        const markdownViewer = element.querySelector('.content .markdown-viewer');
        if (markdownViewer) {
          content = markdownViewer.innerText.trim();
        } else {
          const contentDiv = element.querySelector('.content') || element;
          content = contentDiv.innerText.trim();
        }
      }

      if (content && content.length > 0 && !this.isUIElement(content)) {
        // 转换role到sender格式（统一使用sender字段）
        const sender = role === 'user' ? 'user' : 'AI';

        // 合并连续的同角色消息
        if (messages.length > 0 && messages[messages.length - 1].sender === sender) {
          // 如果上一条消息角色相同，则合并内容
          messages[messages.length - 1].content += '\n\n' + content;
        } else {
          // 否则添加新消息
          messages.push({
            sender: sender,
            content: content,
            timestamp: Date.now()
          });
        }
      }
    });

    console.log(`Keep AI Memory (Genspark): 提取到 ${messages.length} 条消息`);
    return messages;
  }

  /**
   * 开始监听DOM变化
   * 重写基类方法以添加定时检查
   */
  startObserving() {
    // 调用基类方法设置MutationObserver
    const observer = super.setupMutationObserver();
    this.contentObserver = observer;

    // 添加定期检查（每15秒）
    if (this.periodicCheckInterval) clearInterval(this.periodicCheckInterval);
    this.periodicCheckInterval = setInterval(() => {
        console.log('Keep AI Memory (Genspark): 定期检查新消息...');
        this.checkForActualMessageChanges();
    }, 15000);
  }

  /**
   * 过滤UI元素（针对Genspark，如果消息内容中包含不应该保存的UI文本）
   * 从提供的HTML看，Copy/Deep Research按钮在 bubble 外，innerText应该比较干净
   * 但可以保留一些通用过滤
   * @param {string} text 
   * @returns {boolean} - 是否为UI元素
   */
  isUIElement(text) {
    const uiPatterns = [
      'Copy', 'Deep Research', 'Save to Notion' // Text that might appear in a message but is UI control
    ];
    return uiPatterns.some(pattern => text === pattern || text.includes(pattern + ' ')); // Check for exact match or pattern followed by space
  }

  /**
   * 提取标题
   * Genspark的对话标题存储在特定meta viewport标签之后紧挨着的<title>标签中
   * @returns {string} - 提取的标题
   */
  extractTitle() {
    // 策略1: 从特定meta viewport标签之后的title标签提取（主要方法）
    // 查找特定的meta viewport标签
    const metaViewport = document.querySelector('meta[name="viewport"][content*="viewport-fit=cover"]');

    if (metaViewport) {
      // 查找紧挨着的下一个兄弟元素
      let nextElement = metaViewport.nextElementSibling;

      // 跳过可能的空白文本节点或注释，查找title标签
      while (nextElement) {
        if (nextElement.tagName === 'TITLE') {
          const titleText = nextElement.textContent.trim();
          if (titleText.length > 0) {
            // 移除可能的网站后缀（如 " - Genspark"）
            const cleanTitle = titleText.replace(/\s*[-–—|]\s*Genspark.*$/i, '').trim();
            if (cleanTitle.length > 0) {
              return cleanTitle;
            }
          }
          break;
        }
        // 如果不是title标签，继续查找下一个兄弟元素
        // 但只查找相邻的几个元素，避免走太远
        if (nextElement.tagName !== 'META' && nextElement.tagName !== 'LINK') {
          break;
        }
        nextElement = nextElement.nextElementSibling;
      }
    }

    // 策略2: 从输入框提取 (agent name)
    const nameInput = document.querySelector('input.agent-name-input');
    if (nameInput && nameInput.value && nameInput.value.trim().length > 0) {
      return nameInput.value.trim();
    }

    // 策略3: 从页面中查找标题元素
    const titleElement = document.querySelector('h1') ||
                        document.querySelector('[class*="title"]');
    if (titleElement && titleElement.innerText.trim().length > 0) {
      return titleElement.innerText.trim();
    }

    // 策略4: 从第一条用户消息提取
    const messages = this.extractMessages();
    if (messages.length > 0) {
      const firstUserMessage = messages.find(msg => msg.sender === 'user');
      if (firstUserMessage && firstUserMessage.content) {
        const content = firstUserMessage.content.trim();
        const cleanContent = content.replace(/\s+/g, ' ').trim();
        // 限制长度为60个字符
        return cleanContent.substring(0, 60) + (cleanContent.length > 60 ? '...' : '');
      }
    }

    // 默认标题
    return 'Genspark Conversation';
  }
}

// 初始化
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const adapter = new GensparkAdapter();
    adapter.start();
    window.AdapterInstance = adapter;
  });
}
