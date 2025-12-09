/**
 * Chat Memo - Manus平台适配器
 * 继承BasePlatformAdapter，实现Manus平台特定的逻辑
 *
 * 特点：使用基于文本内容分析的启发式方法提取用户消息和AI响应
 */

class ManusAdapter extends BasePlatformAdapter {
  /**
   * 构造函数
   */
  constructor() {
    super('manus');
    this.lastExtractedContent = '';
    this.retryCount = 0;
    this.maxRetries = 10;
    // Use 300ms debounce (consistent with existing adapters)
    // Platform analysis suggests 1000ms as conservative alternative
    // Current value proven effective across ChatGPT/Claude/Gemini
    this.DEBOUNCE_DELAY = 300;
  }

  /**
   * 验证是否为有效的Manus对话URL
   * @param {string} url - 要验证的URL
   * @returns {boolean} - 是否为有效的对话URL
   */
  isValidConversationUrl(url) {
    return /^https:\/\/manus\.im\/app\/[A-Za-z0-9]+/.test(url);
  }

  /**
   * 从URL中提取任务ID
   * @param {string} url - 要分析的URL
   * @returns {Object} - 包含conversationId和isNewConversation的对象
   */
  extractConversationInfo(url) {
    const match = url.match(/\/app\/([A-Za-z0-9]+)/);
    return {
      conversationId: match ? `manus_${match[1]}` : null,
      isNewConversation: false
    };
  }

  /**
   * 判断文本是否像用户消息
   * @param {string} text - 要判断的文本
   * @returns {boolean} - 是否像用户消息
   */
  looksLikeUserMessage(text) {
    // 用户消息特征
    const userPatterns = [
      '如何', '怎么', '写一个', '帮我', '能否', '请',
      'how', 'write', 'help me', 'can you', 'please'
    ];

    // 长度适中（通常 < 500 字符）
    if (text.length > 500) return false;

    // 不包含代码块
    if (text.includes('```') || text.includes('function')) return false;

    // 包含问题或请求关键词
    return userPatterns.some(pattern =>
      text.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * 过滤UI元素和元数据
   * @param {string} text - 要检查的文本
   * @returns {boolean} - 是否为UI元素或应该过滤的内容
   */
  isUIElement(text) {
    const uiPatterns = [
      'New task', 'Search', 'Library', 'Projects',
      'Share Manus', 'Manus 1.5', '优化指令', 'Settings'
    ];

    // 过滤UI元素
    if (uiPatterns.some(pattern => text.includes(pattern))) {
      return true;
    }

    // 过滤纯时间戳（如 "00:12"）
    if (/^\d{1,2}:\d{2}$/.test(text.trim())) {
      return true;
    }

    // 过滤太短的文本（可能是UI标签）
    if (text.trim().length < 3) {
      return true;
    }

    return false;
  }

  /**
   * 清理消息内容，移除时间戳前缀
   * @param {string} content - 原始内容
   * @returns {string} - 清理后的内容
   */
  cleanMessageContent(content) {
    if (!content) return '';

    // 移除开头的时间戳（如 "00:12 消息内容" -> "消息内容"）
    let cleaned = content.replace(/^\d{1,2}:\d{2}\s+/, '').trim();

    // 移除多余的空白字符
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * 查找用户消息（基于启发式文本分析）
   * @returns {string|null} - 找到的用户消息或null
   */
  findUserMessage() {
    const bodyText = document.body.innerText;
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // AI响应起始模式
    const aiResponsePatterns = [
      '好的！', '收到！', '明白了', 'I am currently',
      'Let me', 'I will', '已完成'
    ];

    // 查找AI响应前的文本（可能是用户消息）
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 跳过UI元素
      if (this.isUIElement(line)) continue;

      // 检查是否是用户消息特征
      if (this.looksLikeUserMessage(line)) {
        // 验证下一行是否是AI响应
        const nextLine = lines[i + 1] || '';
        if (aiResponsePatterns.some(pattern => nextLine.includes(pattern))) {
          return line;
        }
      }
    }

    return null;
  }

  /**
   * 提取AI响应（捕获多部分内容）
   * @returns {string|null} - 提取的AI响应或null
   */
  extractAIResponse() {
    const bodyText = document.body.innerText;
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let response = '';
    let capturing = false;

    const aiStartPatterns = [
      '好的！', '收到！', '明白了', 'I am currently', '已完成'
    ];

    const stopPatterns = [
      'Send message to Manus',
      'How was this result?',
      'Suggested follow-ups'
    ];

    for (const line of lines) {
      // 开始捕获AI响应
      if (!capturing && aiStartPatterns.some(p => line.includes(p))) {
        capturing = true;
      }

      // 停止捕获（遇到边界）
      if (capturing && stopPatterns.some(p => line.includes(p))) {
        break;
      }

      // 捕获内容
      if (capturing && !this.isUIElement(line)) {
        response += line + '\n';
      }
    }

    return response.trim() || null;
  }

  /**
   * 提取页面上的所有消息
   * @returns {Array} - 消息数组
   */
  extractMessages() {
    const messages = [];

    // 查找聊天主容器
    // 基于提供的HTML片段，用户消息是 items-end，AI消息可能是 items-start
    // 我们查找包含这些消息的共同父容器
    
    // 策略：查找所有可能的消息行
    // 用户消息包含 items-end 和 justify-end
    const userMessageRows = document.querySelectorAll('div[class*="items-end"][class*="justify-end"][data-event-id]');
    
    // AI消息通常在其后，或者是其他样式的行
    // 我们可以尝试查找所有 data-event-id 的元素，然后根据内部特征区分
    const allMessageRows = document.querySelectorAll('div[data-event-id]');
    
    if (allMessageRows.length === 0) {
        // 如果找不到 data-event-id，尝试回退到旧的启发式方法
        const userMessage = this.findUserMessage();
        if (userMessage) {
            messages.push({ role: 'user', content: userMessage, timestamp: Date.now() });
        }
        const aiResponse = this.extractAIResponse();
        if (aiResponse) {
            messages.push({ role: 'assistant', content: aiResponse, timestamp: Date.now() });
        }
        return messages;
    }
    
    allMessageRows.forEach(row => {
        let role = 'assistant';
        let content = '';
        
        // 判定角色：精确检查类名
        if (row.classList.contains('items-end') && row.classList.contains('justify-end')) {
            role = 'user';
        }
        
        // 提取内容
        if (role === 'user') {
            // 用户消息通常在 whitespace-pre-wrap 的 span 或 div 中
            const contentEl = row.querySelector('.whitespace-pre-wrap');
            if (contentEl) {
                content = contentEl.innerText.trim();
            }
        } else {
            // AI消息
            // 尝试查找 markdown 渲染区域或普通文本
            // Manus 的 AI 消息可能包含多个步骤（steps）和最终回答
            // 我们提取整个文本内容，或者寻找特定的 markdown 容器
            const contentEl = row.querySelector('.markdown-body') || row;
            content = contentEl.innerText.trim();
        }

        // 清理消息内容（移除时间戳等）
        content = this.cleanMessageContent(content);

        if (content && content.length > 0 && !this.isUIElement(content)) {
            // 合并连续的AI消息
            if (role === 'assistant' && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
                // 如果上一条也是AI消息，则合并内容
                messages[messages.length - 1].content += '\n\n' + content;
            } else {
                // 否则添加新消息
                messages.push({
                    role: role,
                    content: content,
                    timestamp: Date.now() // 注意：这里最好能提取实际时间，但目前片段里只有 hover 可见的时间
                });
            }
        }
    });

    return messages;
  }

  /**
   * 检查元素是否为消息元素
   * Manus没有明确的消息元素标记，依赖MutationObserver触发后的完整提取
   * @param {Node} node - 要检查的DOM节点
   * @returns {boolean} - 是否为消息元素
   */
  isMessageElement(node) {
    return false;
  }

  /**
   * 提取标题
   * @returns {string} - 提取的标题
   */
  extractTitle() {
    // 策略1: 尝试从页面UI提取对话标题
    const titleElement = document.querySelector('.text-base.font-medium.truncate');
    if (titleElement && titleElement.innerText.trim()) {
      const title = titleElement.innerText.trim();
      if (title !== 'Manus Task' && title.length > 0) {
        return title;
      }
    }

    // 策略2: 从提取的消息中获取第一条用户消息作为标题
    const messages = this.extractMessages();
    if (messages.length > 0) {
      // 查找第一条用户消息
      const firstUserMessage = messages.find(msg => msg.role === 'user');
      if (firstUserMessage && firstUserMessage.content) {
        const content = firstUserMessage.content.trim();
        // 清理内容：移除多余的空白和换行
        const cleanContent = content.replace(/\s+/g, ' ').trim();
        // 限制长度为60个字符
        return cleanContent.substring(0, 60) + (cleanContent.length > 60 ? '...' : '');
      }

      // 如果没有用户消息，使用第一条助手消息
      const firstMessage = messages[0];
      if (firstMessage && firstMessage.content) {
        const content = firstMessage.content.trim();
        const cleanContent = content.replace(/\s+/g, ' ').trim();
        return cleanContent.substring(0, 60) + (cleanContent.length > 60 ? '...' : '');
      }
    }

    // 策略3: 尝试从页面标题提取
    const pageTitle = document.title;
    if (pageTitle && !pageTitle.includes('Manus') && pageTitle !== 'Manus Task') {
      return pageTitle;
    }

    // 策略4: 使用启发式方法查找用户消息
    const userMessage = this.findUserMessage();
    if (userMessage && userMessage.length > 0) {
      const cleanContent = userMessage.replace(/\s+/g, ' ').trim();
      return cleanContent.substring(0, 60) + (cleanContent.length > 60 ? '...' : '');
    }

    // 默认标题
    return 'Manus Conversation';
  }

  /**
   * 初始化适配器（带重试机制）
   */
  init() {
    if (this.isValidConversationUrl(window.location.href)) {
      this.initWithRetry();
    }
  }

  /**
   * 带重试的初始化
   */
  initWithRetry() {
    const container = document.querySelector('main') ||
                     document.querySelector('[role="main"]') ||
                     document.querySelector('body');

    if (!container && this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`Keep AI Memory (Manus): 重试初始化 (${this.retryCount}/${this.maxRetries})`);
      setTimeout(() => this.initWithRetry(), 1000);
      return;
    }

    if (container) {
      console.log('Keep AI Memory (Manus): 初始化成功');
      this.startObserving();
    } else {
      console.error('Keep AI Memory (Manus): 初始化失败，未找到容器');
    }
  }

  /**
   * 开始监听DOM变化
   */
  startObserving() {
    if (this.contentObserver) {
      this.contentObserver.disconnect();
    }

    const container = document.querySelector('body');

    this.contentObserver = new MutationObserver(() => {
      // 使用debounce避免频繁触发
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.handleMutation();
      }, this.DEBOUNCE_DELAY);
    });

    this.contentObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    // 添加定期检查（每30秒）
    if (this.periodicCheckInterval) clearInterval(this.periodicCheckInterval);
    this.periodicCheckInterval = setInterval(() => {
        console.log('Keep AI Memory (Manus): 定期检查新消息...');
        this.checkForActualMessageChanges();
    }, 30000);

    // 首次提取
    this.handleMutation();
  }

  /**
   * 处理DOM变化（带去重）
   */
  handleMutation() {
    const messages = this.extractMessages();
    const currentContent = JSON.stringify(messages);

    // 去重检查
    if (currentContent !== this.lastExtractedContent && messages.length > 0) {
      this.lastExtractedContent = currentContent;
      console.log('Keep AI Memory (Manus): 检测到新内容', messages);

      // 调用基类保存逻辑
      this.checkForActualMessageChanges();
    }
  }
}

// 初始化
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const adapter = new ManusAdapter();
    adapter.start();
    window.AdapterInstance = adapter;
  });
}
