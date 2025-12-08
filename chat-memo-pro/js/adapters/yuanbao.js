/**
 * Chat Memo - 腾讯元宝平台适配器
 * 继承BasePlatformAdapter，只实现平台特定的逻辑
 */

class YuanbaoAdapter extends BasePlatformAdapter {
  constructor() {
    super('yuanbao');
  }

  /**
   * 验证是否为有效的腾讯元宝对话URL
   * @param {string} url - 要验证的URL
   * @returns {boolean} - 是否为有效的对话URL
   */
  isValidConversationUrl(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;

      // 检查域名
      if (!hostname.includes('yuanbao.tencent.com')) {
        return false;
      }
      
      const validPatterns = [
        /^\/chat\/[^/]+\/[^/]+$/ // /chat/app_id/conversation_id
      ];
      
      const isValid = validPatterns.some(pattern => pattern.test(pathname));
      console.log(`Keep AI Memory: 元宝URL验证结果: ${isValid}`);
      
      return isValid;
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
      console.log(`Keep AI Memory: 开始提取元宝对话信息 - URL: ${url}`);
      
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      console.log(`Keep AI Memory: 元宝路径: ${pathname}`);
      
      const pathWithoutLeadingSlash = pathname.startsWith('/') ? pathname.substring(1) : pathname;
      
      if (pathWithoutLeadingSlash) {
        result.conversationId = pathWithoutLeadingSlash.replace(/\//g, '_');
      } else {
        const conversationElement = document.querySelector('[data-conv-id]');
        if (conversationElement) {
          const dataConvId = conversationElement.getAttribute('data-conv-id');
          if (dataConvId) {
            const idParts = dataConvId.split('_');
            if (idParts.length > 0) {
              result.conversationId = idParts[0];
            }
          }
        }
      }
      
      result.isNewConversation = !result.conversationId || result.conversationId === 'new';
      
      console.log(`Keep AI Memory: 提取到腾讯元宝对话ID: ${result.conversationId}`);
      
      return result;
    } catch (error) {
      console.error('Keep AI Memory: 解析URL失败:', error);
      return result;
    }
  }

  /**
   * 检查元素是否为消息元素
   * @param {Node} node - 要检查的DOM节点
   * @returns {boolean} - 是否为消息元素
   */
  isMessageElement(node) {
    return (
      node.nodeType === Node.ELEMENT_NODE &&
      node.classList &&
      (node.classList.contains('agent-chat__list__item--human') ||
       node.classList.contains('agent-chat__list__item--ai'))
    );
  }

  /**
   * 提取页面上的所有消息
   * @returns {Array} - 消息数组
   */
  extractMessages() {
    const messages = [];
    
    console.log('Keep AI Memory: 开始提取元宝消息');
    
    const chatContainer = document.querySelector('.agent-chat__list__content');
    
    if (!chatContainer) {
      console.log('Keep AI Memory: 未找到对话容器 .agent-chat__list__content');
      return messages;
    }
    
    const userMessages = chatContainer.querySelectorAll('.agent-chat__list__item--human');
    const aiMessages = chatContainer.querySelectorAll('.agent-chat__list__item--ai');
    
    console.log(`Keep AI Memory: 找到 ${userMessages.length} 条用户消息, ${aiMessages.length} 条AI消息`);
    const existTextarea = Array.from(userMessages).find(element => this.isInEditMode(element));
    if (existTextarea) {
      console.log('Keep AI Memory: 检测到用户正在编辑，跳过消息提取');
      return [];
    }
    const allMessageElements = [];
    
    userMessages.forEach(element => {
      allMessageElements.push({ element, type: 'user' });
    });
    
    aiMessages.forEach(element => {
      allMessageElements.push({ element, type: 'ai' });
    });
    
    // 按DOM顺序排序
    allMessageElements.sort((a, b) => {
      const position = a.element.compareDocumentPosition(b.element);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
      } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1;
      }
      return 0;
    });
    
    allMessageElements.forEach((messageInfo, index) => {
      const { element, type } = messageInfo;
      let content = '';
      let thinking = '';
      
      if (type === 'user') {
        const contentElement = element.querySelector('.hyc-content-text');
        if (contentElement) {
          content = contentElement.innerText.trim();
        }
      } else if (type === 'ai') {
        // 提取思考内容（如果存在）
        const thinkingElement = element.querySelector('.hyc-component-reasoner__think-content');
        if (thinkingElement) {
          thinking = thinkingElement.innerText.trim();
          
          const reasonerTextElement = element.querySelector('.hyc-component-reasoner__text');
          if (reasonerTextElement) {
            content = this.extractFormattedContent(reasonerTextElement);
          }
        } else {
          const speechTextElement = element.querySelector('.agent-chat__speech-text');
          if (speechTextElement) {
            content = this.extractFormattedContent(speechTextElement);
          }
        }
        
        // 兜底方案：直接从AI消息元素提取内容
        if (!content) {
          content = this.extractFormattedContent(element);
        }
      }
      
      if (content) {
        const messageId = this.generateMessageId(type === 'user' ? 'user' : 'AI', content, index);
        
        messages.push({
          messageId,
          sender: type === 'user' ? 'user' : 'AI',
          content: content,
          thinking: thinking,
          position: index,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });
    
    console.log(`Keep AI Memory: 腾讯元宝成功提取 ${messages.length} 条消息`);
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

function initYuanbaoAdapter() {
  console.log('Keep AI Memory: 开始初始化腾讯元宝适配器');
  
  if (typeof BasePlatformAdapter === 'undefined') {
    console.error('Keep AI Memory: BasePlatformAdapter未加载');
    return;
  }
  
  const adapter = new YuanbaoAdapter();
  adapter.start();
  console.log('Keep AI Memory: 腾讯元宝适配器已启动');
}

initYuanbaoAdapter(); 