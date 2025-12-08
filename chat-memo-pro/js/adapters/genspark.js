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
   * @returns {Array} - 消息数组
   */
  extractMessages() {
    const messages = [];

    // 查找所有消息气泡元素
    const messageBubbles = document.querySelectorAll('div.bubble[message-content-id]');

    if (messageBubbles.length === 0) {
      console.log('Keep AI Memory (Genspark): 未找到任何消息气泡元素');
      return messages;
    }

    messageBubbles.forEach(bubble => {
      let role = 'assistant';
      let content = '';

      // Determine role:
      // Priority 1: Check for the explicit 'conversation-item-desc user' ancestor
      const userDescParent = bubble.closest('.conversation-item-desc.user');
      
      if (userDescParent) {
        role = 'user';
      } else {
        // Fallback/Priority 2: Heuristic based on content structure
        // User messages often contain 'pre code' directly, while AI messages often contain 'markdown-viewer'
        const preCodeElement = bubble.querySelector('.content pre code');
        const markdownViewerElement = bubble.querySelector('.content .markdown-viewer');

        // If it has a <pre><code> block AND no markdown viewer, it's very likely a user message
        // Also checking if the bubble itself has specific user-like classes if available (though Genspark seems to use parent wrapper)
        if (preCodeElement && !markdownViewerElement) {
          role = 'user';
        } else {
          // Default to assistant if no clear user indicator
          role = 'assistant';
        }
      }

      if (role === 'user') {
        // For user messages, try specific code block first, then fallback to generic content
        const codeElement = bubble.querySelector('.content pre code');
        if (codeElement) {
          content = codeElement.innerText.trim();
        } else {
          // Fallback: try getting text directly from content div if pre/code structure changes
          const contentDiv = bubble.querySelector('.content');
          if (contentDiv) {
            content = contentDiv.innerText.trim();
          }
        }
      } else { // role is assistant
        // Priority 1: Markdown viewer content
        const markdownViewer = bubble.querySelector('.content .markdown-viewer');
        if (markdownViewer) {
          content = markdownViewer.innerText.trim();
        } else {
          // Priority 2: Direct content text (fallback)
          const contentDiv = bubble.querySelector('.content');
          if (contentDiv) {
            content = contentDiv.innerText.trim();
          }
        }
      }

      if (content && content.length > 0 && !this.isUIElement(content)) {
        // Merge consecutive AI messages
        if (role === 'assistant' && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
          messages[messages.length - 1].content += '\n\n' + content;
        } else {
          messages.push({
            role: role,
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
   */
  isUIElement(text) {
    const uiPatterns = [
      'Copy', 'Deep Research', 'Save to Notion' // Text that might appear in a message but is UI control
    ];
    return uiPatterns.some(pattern => text === pattern || text.includes(pattern + ' ')); // Check for exact match or pattern followed by space
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
    adapter.start();
    window.AdapterInstance = adapter;
  });
}
