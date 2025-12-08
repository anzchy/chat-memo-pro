/**
 * Chat Memo - DeepSeek平台适配器
 * 继承BasePlatformAdapter，只实现平台特定的逻辑
 */

class DeepSeekAdapter extends BasePlatformAdapter {
  constructor() {
    super('deepseek');
  }

  /**
   * 验证是否为有效的DeepSeek对话URL
   * @param {string} url - 要验证的URL
   * @returns {boolean} - 是否为有效的对话URL
   */
  isValidConversationUrl(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      
      if (!hostname.includes('chat.deepseek.com')) {
        return false;
      }
      
      const validPatterns = [
        /^\/a\/chat\/s\/[^/]+$/ // /a/chat/s/conversation_id
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
          pathWithoutLeadingSlash !== 'a' && 
          pathWithoutLeadingSlash !== 'chat') {
        result.conversationId = pathWithoutLeadingSlash.replace(/\//g, '_');
        
        console.log(`Keep AI Memory: 提取到DeepSeek对话ID: ${result.conversationId}`);
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
    
    if (node.classList.contains('_9663006')) {
      return true;
    }
    
    if (node.classList.contains('_4f9bf79') && node.classList.contains('_43c05b5')) {
      return true;
    }
    
    // 检查是否包含AI消息的内容元素
    if (node.querySelector('.ds-markdown-paragraph') || 
        node.querySelector('.e1675d8b') ||
        node.querySelector('[class*="markdown"]') ||
        node.querySelector('[class*="thinking"]')) {
      return true;
    }
    
    // 检查父元素是否为消息容器
    let parent = node.parentElement;
    while (parent && parent !== document.body) {
      if (parent.classList.contains('_9663006') || 
          (parent.classList.contains('_4f9bf79') && parent.classList.contains('_43c05b5'))) {
        return true;
      }
      parent = parent.parentElement;
    }
    
    return false;
  }

  /**
   * 从页面提取标题
   * @returns {string|null} - 提取的标题或null
   */
  extractTitle() {
    const chatWindow = document.querySelector('.dad65929');
    if (!chatWindow) return null;
    
    const firstUserMessage = chatWindow.querySelector('._9663006 .fbb737a4');
    if (firstUserMessage) {
      const text = firstUserMessage.innerText.trim();
      return text.length > 50 ? text.substring(0, 50) + '...' : text;
    }
    
    return null;
  }

  /**
   * 提取页面上的所有消息
   * @returns {Array} - 消息数组
   */
  extractMessages() {
    const messages = [];
    const seenContents = new Set();
    
    const chatWindow = document.querySelector('.dad65929');
    if (!chatWindow) {
      console.log('Keep AI Memory: 未找到对话窗口');
      return messages;
    }
    
    let messageElements = chatWindow.querySelectorAll('._9663006, ._4f9bf79._43c05b5');

    const existTextarea = Array.from(messageElements).find(element => this.isInEditMode(element));
    if (existTextarea) {
      console.log('Keep AI Memory: 检测到用户正在编辑，跳过消息提取');
      return [];
    }
    
    // 备用选择器策略
    if (messageElements.length === 0) {
      const alternativeSelectors = [
        '[class*="message"]',
        '[class*="chat"]', 
        '.ds-markdown-paragraph',
        '.fbb737a4'
      ];
      
      for (const selector of alternativeSelectors) {
        const elements = chatWindow.querySelectorAll(selector);
        if (elements.length > 0) {
          const messageContainers = new Set();
          elements.forEach(el => {
            let parent = el.parentElement;
            while (parent && parent !== chatWindow) {
              if (parent.classList.length > 0) {
                messageContainers.add(parent);
                break;
              }
              parent = parent.parentElement;
            }
          });
          
          if (messageContainers.size > 0) {
            messageElements = Array.from(messageContainers);
            break;
          }
        }
      }
    }
    
    console.log(`Keep AI Memory: 找到 ${messageElements.length} 条消息元素`);
    
    messageElements.forEach((element, index) => {
      const isUserMessage = element.classList.contains('_9663006');
      const sender = isUserMessage ? 'user' : 'AI';
      let content = '';
      let thinking = '';
      
      if (isUserMessage) {
        const userTextElement = element.querySelector('.fbb737a4');
        if (userTextElement) {
          content = userTextElement.innerText.trim();
        }
      } else {
        // 查找AI thinking元素
        let thinkingElement = element.querySelector('.e1675d8b');
        if (!thinkingElement) {
          const potentialThinkingElements = element.querySelectorAll('div[class*="thinking"], div[class*="thought"], .thinking-content');
          if (potentialThinkingElements.length > 0) {
            thinkingElement = potentialThinkingElements[0];
          }
        }
        if (thinkingElement) {
          thinking = thinkingElement.innerText.trim();
        }
        
        // 查找AI消息的文本元素
        const markdownContainer = element.querySelector('.ds-markdown, .ds-markdown--block');
        
        if (markdownContainer) {
          content = this.extractFormattedContent(markdownContainer);
        } else {
          let aiParagraphs = element.querySelectorAll('.ds-markdown-paragraph');
          
          if (aiParagraphs.length > 0) {
            content = Array.from(aiParagraphs)
              .map(p => p.innerText.trim())
              .filter(text => text)
              .join('\n');
          } else {
            const alternativeSelectors = [
              '.markdown-content',
              '.message-content', 
              '.ai-response',
              '[class*="markdown"]',
              '[class*="content"]'
            ];
            
            for (const selector of alternativeSelectors) {
              const contentElements = element.querySelectorAll(selector);
              if (contentElements.length > 0) {
                content = Array.from(contentElements)
                  .map(el => this.extractFormattedContent(el))
                  .filter(text => text)
                  .join('\n');
                if (content) break;
              }
            }
            
            // 兜底方案：直接提取元素文本内容
            if (!content) {
              const elementText = element.innerText.trim();
              if (elementText) {
                if (thinking && elementText.includes(thinking)) {
                  content = elementText.replace(thinking, '').trim();
                } else {
                  content = elementText;
                }
              }
            }
          }
        }
      }
      
      if (content) {
        const contextKey = this.generateContextAwareKey(sender, content, index, messages);
        
        if (seenContents.has(contextKey)) {
          console.log(`Keep AI Memory: 跳过重复内容: ${content.substring(0, 50)}...`);
          return;
        }
        
        seenContents.add(contextKey);
        
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
    
    console.log(`Keep AI Memory: DeepSeek成功提取 ${messages.length} 条消息`);
    return messages;
  }

  generateContextAwareKey(sender, content, index, messages) {
    console.log('Keep AI Memory: 生成上下文感知的去重键', sender, content, index, messages);
    if (sender === 'user') {
      const previousAIMessage = messages.findLast(msg => msg.sender === 'AI');
      const context = previousAIMessage ? previousAIMessage.content.substring(0, 50) : '';
      return `${sender}:${content.substring(0, 100)}:ctx_${this.hashContent(context)}`;
    }
    
    if (sender === 'AI') {
      const previousUserMessage = messages.findLast(msg => msg.sender === 'user');
      const context = previousUserMessage ? previousUserMessage.content.substring(0, 50) : '';
      return `${sender}:${content.substring(0, 100)}:ctx_${this.hashContent(context)}`;
    }
    
    return `${sender}:${content.substring(0, 100)}`;
  }

  hashContent(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36);
  }
}

function initDeepSeekAdapter() {
  if (typeof BasePlatformAdapter === 'undefined') {
    console.error('Keep AI Memory: BasePlatformAdapter未加载');
    return;
  }
  
  const adapter = new DeepSeekAdapter();
  adapter.start();
}

initDeepSeekAdapter(); 