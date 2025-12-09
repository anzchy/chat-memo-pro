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
   * 使用精准选择器区分用户和AI消息
   * @returns {Array} - 消息数组
   */
  extractMessages() {
    const messages = [];
    const processedElements = new Set(); // 避免重复处理

    // 精准选择器：用户消息
    const userMessageElements = document.querySelectorAll('.transition-all.duration-300');

    // 精准选择器：AI消息
    const aiMessageElements = document.querySelectorAll('.manus-markdown.group');

    // 用户附件（特殊Tailwind group/attach语法）
    const userAttachments = document.querySelectorAll('[class*="group/attach"]');

    // 创建所有元素的数组并按DOM顺序排序
    const allElements = [];

    userMessageElements.forEach(el => {
      allElements.push({ element: el, role: 'user', type: 'message' });
    });

    aiMessageElements.forEach(el => {
      allElements.push({ element: el, role: 'assistant', type: 'message' });
    });

    userAttachments.forEach(el => {
      allElements.push({ element: el, role: 'user', type: 'attachment' });
    });

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
    allElements.forEach(({ element, role, type }) => {
      if (processedElements.has(element)) {
        return; // 跳过已处理的元素
      }
      processedElements.add(element);

      let content = '';

      if (type === 'attachment') {
        // 处理用户附件
        // 提取文件名或附件描述
        const fileName = element.querySelector('.text-sm') || element;
        content = `[附件] ${fileName.innerText.trim()}`;
      } else if (role === 'user') {
        // 用户消息：提取文本内容
        const contentEl = element.querySelector('.whitespace-pre-wrap') || element;
        content = contentEl.innerText.trim();
      } else if (role === 'assistant') {
        // AI消息：提取markdown内容
        content = element.innerText.trim();
      }

      // 清理消息内容（移除时间戳等）
      content = this.cleanMessageContent(content);

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

    // 如果没有找到任何消息，回退到启发式方法
    if (messages.length === 0) {
      const userMessage = this.findUserMessage();
      if (userMessage) {
        messages.push({ sender: 'user', content: userMessage, timestamp: Date.now() });
      }
      const aiResponse = this.extractAIResponse();
      if (aiResponse) {
        messages.push({ sender: 'AI', content: aiResponse, timestamp: Date.now() });
      }
    }

    return messages;
  }

  /**
   * 检查元素是否为消息元素
   * 使用精准选择器识别用户消息、AI消息和附件
   * @param {Node} node - 要检查的DOM节点
   * @returns {boolean} - 是否为消息元素
   */
  isMessageElement(node) {
    if (!node || !node.matches) {
      return false;
    }

    // 用户消息
    if (node.matches('.transition-all.duration-300')) {
      return true;
    }

    // AI消息
    if (node.matches('.manus-markdown.group')) {
      return true;
    }

    // 用户附件（group/attach是Tailwind的group modifier语法）
    if (node.classList && Array.from(node.classList).some(cls => cls.includes('group/attach'))) {
      return true;
    }

    return false;
  }

  /**
   * 提取标题
   * Manus的对话标题存储在canonical link标签之后紧挨着的<title>标签中
   * @returns {string} - 提取的标题
   */
  extractTitle() {
    // 策略1: 从canonical link标签之后的title标签提取（主要方法）
    // 查找特定的canonical link标签（href以https://manus.im/app开头）
    const canonicalLink = document.querySelector('link[rel="canonical"][href^="https://manus.im/app"]');

    if (canonicalLink) {
      // 查找紧挨着的下一个兄弟元素
      let nextElement = canonicalLink.nextElementSibling;

      // 跳过可能的空白文本节点或其他meta/link标签，查找title标签
      while (nextElement) {
        if (nextElement.tagName === 'TITLE') {
          const titleText = nextElement.textContent.trim();
          if (titleText.length > 0) {
            // 移除可能的网站后缀（如 " - Manus"）
            const cleanTitle = titleText.replace(/\s*[-–—|]\s*Manus.*$/i, '').trim();
            if (cleanTitle.length > 0 && cleanTitle !== 'Manus Task') {
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

    // 策略2: 尝试从页面UI提取对话标题
    const titleElement = document.querySelector('.text-base.font-medium.truncate');
    if (titleElement && titleElement.innerText.trim()) {
      const title = titleElement.innerText.trim();
      if (title !== 'Manus Task' && title.length > 0) {
        return title;
      }
    }

    // 策略3: 从提取的消息中获取第一条用户消息作为标题
    const messages = this.extractMessages();
    if (messages.length > 0) {
      // 查找第一条用户消息
      const firstUserMessage = messages.find(msg => msg.sender === 'user');
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
