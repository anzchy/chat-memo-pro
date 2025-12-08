/**
 * Chat Memo - Kimi平台适配器
 * 继承BasePlatformAdapter,只实现平台特定的逻辑
 */

class KimiAdapter extends BasePlatformAdapter {
  constructor() {
    super('kimi');
  }

  /**
   * 验证是否为有效的Kimi对话URL
   * @param {string} url - 要验证的URL
   * @returns {boolean} - 是否为有效的对话URL
   */
  isValidConversationUrl(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;

      if (!hostname.includes('kimi.com')) {
        return false;
      }

      // 匹配 /chat/ 后面有具体路径的情况
      const validPatterns = [
        /^\/chat\/[^/]+.*$/
      ];

      return validPatterns.some(pattern => pattern.test(pathname));
    } catch (error) {
      console.error('Keep AI Memory: URL验证失败:', error);
      return false;
    }
  }

  /**
   * 从URL中提取对话ID
   * @param {string} url - 要分析的URL
   * @returns {Object} - 包含对话ID和是否为新对话的对象
   */
  extractConversationInfo(url) {
    const result = {
      conversationId: null,
      isNewConversation: false
    };

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      const pathWithoutLeadingSlash = pathname.startsWith('/') ? pathname.substring(1) : pathname;

      if (pathWithoutLeadingSlash &&
          pathWithoutLeadingSlash !== '' &&
          pathWithoutLeadingSlash !== 'chat') {
        result.conversationId = pathWithoutLeadingSlash.replace(/\//g, '_');

        console.log(`Keep AI Memory: 提取到Kimi对话ID: ${result.conversationId}`);
      }

      return result;
    } catch (error) {
      console.error('Keep AI Memory: 解析URL时出错:', error);
      return result;
    }
  }

  /**
   * 检查元素是否为消息元素
   * @param {Node} node - 要检查的DOM节点
   * @returns {boolean} - 是否为消息元素
   */
  isMessageElement(node) {
    if (node.nodeType !== Node.ELEMENT_NODE || !node.classList) {
      return false;
    }

    // 检查是否为消息容器
    return node.classList.contains('chat-content-item');
  }

  /**
   * 提取页面上的所有消息
   * @returns {Array} - 消息数组
   */
  extractMessages() {
    const messages = [];

    console.log('Keep AI Memory: 开始提取Kimi消息');

    // 查找所有消息容器
    const messageContainers = document.querySelectorAll('.chat-content-item');

    if (messageContainers.length === 0) {
      console.log('Keep AI Memory: 未找到消息容器');
      return messages;
    }

    console.log(`Keep AI Memory: 找到 ${messageContainers.length} 个消息容器`);

    // 检查是否有用户正在编辑
    const existTextarea = Array.from(messageContainers).find(element => this.isInEditMode(element));
    if (existTextarea) {
      console.log('Keep AI Memory: 检测到用户正在编辑，跳过消息提取');
      return [];
    }

    messageContainers.forEach((container, index) => {
      let content = '';
      let sender = '';

      // 检查是否为用户消息
      const isUserMessage = container.classList.contains('chat-content-item-user');
      if (isUserMessage) {
        sender = 'user';
        // 提取所有 .user-content 的内容
        const userContents = container.querySelectorAll('.user-content');
        const contentParts = [];
        userContents.forEach(userContent => {
          const text = this.extractFormattedContent(userContent);
          if (text) {
            contentParts.push(text);
          }
        });
        content = contentParts.join('\n\n');
      }

      // 检查是否为AI消息
      const isAIMessage = container.classList.contains('chat-content-item-assistant');
      if (isAIMessage) {
        sender = 'AI';

        // 查找所有内容元素（.markdown-container 和 .editor-content），排除 .think-stage 内部的
        const contentElements = [];

        // 收集 markdown-container
        container.querySelectorAll('.markdown-container').forEach(el => {
          if (!el.closest('.think-stage')) {
            contentElements.push(el);
          }
        });

        // 收集 editor-content
        container.querySelectorAll('.editor-content').forEach(el => {
          if (!el.closest('.think-stage')) {
            contentElements.push(el);
          }
        });

        // 按 DOM 顺序排序
        contentElements.sort((a, b) => {
          if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) {
            return -1;
          }
          return 1;
        });

        // 提取文本内容
        const contentParts = [];
        contentElements.forEach(element => {
          const text = this.extractFormattedContent(element);
          if (text) {
            contentParts.push(text);
          }
        });
        content = contentParts.join('\n\n');
      }

      if (content && sender) {
        const messageId = this.generateMessageId(sender, content, index);

        messages.push({
          messageId,
          sender,
          content,
          position: index,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });

    console.log(`Keep AI Memory: Kimi成功提取 ${messages.length} 条消息`);
    return messages;
  }
}

function initKimiAdapter() {
  console.log('Keep AI Memory: 开始初始化Kimi适配器');

  if (typeof BasePlatformAdapter === 'undefined') {
    console.error('Keep AI Memory: BasePlatformAdapter未加载');
    return;
  }

  const adapter = new KimiAdapter();
  adapter.start();
  console.log('Keep AI Memory: Kimi适配器已启动');
}

initKimiAdapter();
