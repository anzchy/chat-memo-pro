/**
 * Chat Memo - Manus平台适配器
 * 继承BasePlatformAdapter，实现Manus平台特定的逻辑
 *
 * 特点：使用基于文本内容分析的启发式方法提取用户消息和AI响应
 */

class ManusAdapter extends BasePlatformAdapter {
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
   * 过滤UI元素
   * @param {string} text - 要检查的文本
   * @returns {boolean} - 是否为UI元素
   */
  isUIElement(text) {
    const uiPatterns = [
      'New task', 'Search', 'Library', 'Projects',
      'Share Manus', 'Manus 1.5', '优化指令', 'Settings'
    ];
    return uiPatterns.some(pattern => text.includes(pattern));
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

    // 提取用户消息
    const userMessage = this.findUserMessage();
    if (userMessage) {
      messages.push({
        role: 'user',
        content: userMessage,
        timestamp: Date.now()
      });
    }

    // 提取AI响应
    const aiResponse = this.extractAIResponse();
    if (aiResponse) {
      messages.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now()
      });
    }

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
    // 尝试从页面标题提取
    const title = document.title;
    if (title && !title.includes('Manus')) {
      return title;
    }

    // 或从用户消息生成标题
    const userMessage = this.findUserMessage();
    if (userMessage && userMessage.length > 0) {
      return userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
    }

    return 'Manus Task';
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
      this.checkAndSaveMessages();
    }
  }
}

// 初始化
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const adapter = new ManusAdapter();
    adapter.init();
  });
}
