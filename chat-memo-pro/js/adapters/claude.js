/**
 * Chat Memo - Claude平台适配器（只获取非折叠结构里的正式回复）
 * 继承BasePlatformAdapter，只实现平台特定的逻辑
 */

class ClaudeAdapter extends BasePlatformAdapter {
  constructor() {
    super('claude');
  }

  /**
   * 验证是否为有效的Claude对话URL
   * @param {string} url - 要验证的URL
   * @returns {boolean} - 是否为有效的对话URL
   */
  isValidConversationUrl(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      
      if (!hostname.includes('claude.ai')) {
        return false;
      }
      
      const validPatterns = [
        /^\/chat\/.*$/ // /chat/*
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
        
        console.log(`Keep AI Memory: 提取到Claude对话ID: ${result.conversationId}`);
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
    return node.hasAttribute('data-test-render-count');
  }

  /**
   * 提取页面上的所有消息
   * @returns {Array} - 消息数组
   */
  extractMessages() {
    const messages = [];
    
    console.log('Keep AI Memory: 开始提取Claude消息');
    
    // 查找所有消息容器
    const messageContainers = document.querySelectorAll('[data-test-render-count]');
    
    if (messageContainers.length === 0) {
      console.log('Keep AI Memory: 未找到消息容器 [data-test-render-count]');
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
      const userMessage = container.querySelector('[data-testid="user-message"]');
      if (userMessage) {
        sender = 'user';
        content = this.extractFormattedContent(userMessage);
      }
      
      // 检查是否为AI消息
      const aiMessage = container.querySelector('.font-claude-response');
      if (aiMessage) {
        sender = 'AI';
        // 只提取正式回复，跳过思考内容（thinking blocks）
        content = this.extractOnlyFormalResponse(aiMessage);
      }
      
      if (content && sender) {
        const messageId = this.generateMessageId(sender, content, index);
        
        messages.push({
          messageId,
          sender,
          content,
          thinking: '', // Claude不提取thinking
          position: index,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });
    
    console.log(`Keep AI Memory: Claude成功提取 ${messages.length} 条消息`);
    return messages;
  }

  /**
   * 只提取正式回复内容，跳过思考部分
   * @param {Element} element - Claude AI消息容器
   * @returns {string} - 提取的正式回复内容
   */
  extractOnlyFormalResponse(element) {
    if (!element) return '';
    
    // 查找所有直接子元素，跳过思考块（thinking blocks）
    const childElements = Array.from(element.children);
    const formalResponseParts = [];
    
    childElements.forEach(child => {
      // 跳过思考块 - 这些通常包含 transition-all、rounded-lg、border 等类名的可折叠容器
      if (this.isThinkingBlock(child)) {
        console.log('Keep AI Memory: 跳过Claude思考块');
        return;
      }
      
      // 提取正式回复内容
      const content = this.extractFormattedContent(child);
      if (content) {
        formalResponseParts.push(content);
      }
    });
    
    return formalResponseParts.join('\n\n').trim();
  }

  /**
   * 检查元素是否为思考块
   * @param {Element} element - 要检查的元素
   * @returns {boolean} - 是否为思考块
   */
  isThinkingBlock(element) {
    if (!element || !element.classList) return false;
    
    // 根据网页示例，思考块通常有以下特征：
    // 1. 包含 transition-all, duration-400, ease-out 类名
    // 2. 包含 rounded-lg, border-0.5 类名  
    // 3. 包含 min-h-[2.625rem] 类名
    // 4. 内部有可折叠的结构
    
    const classList = element.classList;
    const hasThinkingClasses = (
      classList.contains('transition-all') &&
      classList.contains('rounded-lg') &&
      (classList.contains('border-0.5') || classList.contains('border'))
    );
    
    // 额外检查：查看是否包含思考相关的文本提示
    const hasThinkingText = element.textContent && (
      element.textContent.includes('Architected') ||
      element.textContent.includes('Engineered') ||
      element.textContent.includes('s') // 思考时间标识
    );
    
    // 检查是否有可折叠的按钮结构
    const hasCollapsibleButton = element.querySelector('button[aria-expanded]');
    
    return hasThinkingClasses || (hasThinkingText && hasCollapsibleButton);
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

function initClaudeAdapter() {
  console.log('Keep AI Memory: 开始初始化Claude适配器');
  
  if (typeof BasePlatformAdapter === 'undefined') {
    console.error('Keep AI Memory: BasePlatformAdapter未加载');
    return;
  }
  
  const adapter = new ClaudeAdapter();
  adapter.start();
  console.log('Keep AI Memory: Claude适配器已启动');
}

initClaudeAdapter();