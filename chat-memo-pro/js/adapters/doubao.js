/**
 * Chat Memo - 豆包平台适配器
 * 继承BasePlatformAdapter，只实现平台特定的逻辑
 */

class DoubaoAdapter extends BasePlatformAdapter {
  constructor() {
    super('doubao');
  }

  /**
   * 验证是否为有效的豆包对话URL
   * @param {string} url - 要验证的URL
   * @returns {boolean} - 是否为有效的对话URL
   */
  isValidConversationUrl(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      
      if (!hostname.includes('doubao.com')) {
        return false;
      }
      
      // 只处理 /chat/ 后面有具体路径的情况
      // 排除 /chat 或 /chat/ 这种没有具体对话ID的情况
      // 排除 /chat/local 路径
      const validPatterns = [
        /^\/chat\/(?!local)[^/]+.*$/ // /chat/具体路径，但排除local
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
        
        console.log(`Keep AI Memory: 提取到豆包对话ID: ${result.conversationId}`);
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
    if (node.nodeType !== Node.ELEMENT_NODE || !node.hasAttribute) {
      return false;
    }

    // 检查是否为消息容器
    return node.getAttribute('data-testid') === 'union_message';
  }

  /**
   * 提取页面上的所有消息
   * @returns {Array} - 消息数组
   */
  extractMessages() {
    const messages = [];

    console.log('Keep AI Memory: 开始提取豆包消息');

    // 查找所有消息容器
    const messageContainers = document.querySelectorAll('[data-testid="union_message"]');

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
      let thinking = '';
      let sender = '';

      // 检查是否为用户消息
      const sendMessage = container.querySelector('[data-testid="send_message"]');
      if (sendMessage) {
        sender = 'user';
        const userTextElement = sendMessage.querySelector('[data-testid="message_text_content"]');
        if (userTextElement) {
          content = userTextElement.innerText.trim();
        }
      }

      // 检查是否为AI消息
      const receiveMessage = container.querySelector('[data-testid="receive_message"]');
      if (receiveMessage) {
        sender = 'AI';

        // 查找思考内容
        const thinkBlock = receiveMessage.querySelector('[data-testid="think_block_collapse"]');
        if (thinkBlock) {
          const thinkTextElement = thinkBlock.querySelector('[data-testid="message_text_content"]');
          if (thinkTextElement) {
            thinking = this.extractFormattedContent(thinkTextElement);
          }
        }

        // 查找AI回复内容 - 排除思考块内的文本
        const allTextElements = receiveMessage.querySelectorAll('[data-testid="message_text_content"]');
        for (const textElement of allTextElements) {
          if (!textElement.closest('[data-testid="think_block_collapse"]')) {
            content = this.extractFormattedContent(textElement);
            break;
          }
        }
      }

      if (content && sender) {
        const messageId = this.generateMessageId(sender, content, index);

        messages.push({
          messageId,
          sender,
          content,
          thinking,
          position: index,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });

    console.log(`Keep AI Memory: 豆包成功提取 ${messages.length} 条消息`);
    return messages;
  }

  /**
   * 提取格式化内容
   * @param {Element} element - 包含格式化内容的元素
   * @returns {string} - 提取的文本内容
   */
  extractFormattedContent(element) {
    if (!element) return '';
    
    const textContent = element.innerText || element.textContent || '';
    
    return textContent
      .split('\n')
      .map(line => line.trim())
      .filter((line, index, array) => {
        if (line) return true;
        const prevLine = array[index - 1];
        const nextLine = array[index + 1];
        return prevLine && nextLine && prevLine.trim() && nextLine.trim();
      })
      .join('\n')
      .trim();
  }
}

function initDoubaoAdapter() {
  console.log('Keep AI Memory: 开始初始化豆包适配器');
  
  if (typeof BasePlatformAdapter === 'undefined') {
    console.error('Keep AI Memory: BasePlatformAdapter未加载');
    return;
  }
  
  const adapter = new DoubaoAdapter();
  adapter.start();
  console.log('Keep AI Memory: 豆包适配器已启动');
}

initDoubaoAdapter();