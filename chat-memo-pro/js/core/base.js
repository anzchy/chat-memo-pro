/**
 * Chat Memo - 平台适配器基类
 * 抽取所有平台的公共逻辑，各平台只需实现特定的抽象方法
 */

class BasePlatformAdapter {
  constructor(platform) {
    this.platform = platform;
    
    this.pageUrl = window.location.href;
    this.currentConversationId = null;
    this.savedMessageIds = new Set();
    this.lastCheckTime = 0;
    this.isChecking = false;
    this.contentObserver = null;
    
    this.CHECK_INTERVAL = 2000;
    this.currentMessagesMap = new Map();
    this.debounceTimer = null;
    this.DEBOUNCE_DELAY = 1000;
    this.lastMessagesJson = null;
    
    this.lastKnownUrl = '';
    this.lastKnownConversationId = null;
    this.urlCheckInterval = null;
    
    this.isCreatingConversation = false;
    this.creationPromise = null;
    this.currentUrlKey = null;
    
    this.compatibility = null;
    this.storageManager = null;
    
    this.initializeComponents();
  }

  initializeComponents() {
    if (typeof Compatibility !== 'undefined') {
      this.compatibility = new Compatibility();
    }
    
    if (typeof StorageManager !== 'undefined') {
      this.storageManager = new StorageManager();
    }
    
    console.log('Keep AI Memory: 解耦组件初始化完成', {
      hasCompatibility: !!this.compatibility,
      hasStorageManager: !!this.storageManager
    });
  }
  
  /**
   * 验证是否为有效的对话URL
   * @param {string} url - 要验证的URL
   * @returns {boolean} - 是否为有效的对话URL
   */
  isValidConversationUrl(url) {
    throw new Error('子类必须实现 isValidConversationUrl 方法');
  }

  /**
   * 从URL中提取对话信息
   * @param {string} url - 要分析的URL
   * @returns {Object} - 包含conversationId和isNewConversation的对象
   */
  extractConversationInfo(url) {
    throw new Error('子类必须实现 extractConversationInfo 方法');
  }

  /**
   * 提取页面上的所有消息
   * @returns {Array} - 消息数组
   */
  extractMessages() {
    throw new Error('子类必须实现 extractMessages 方法');
  }

  /**
   * 检查元素是否为消息元素
   * @param {Node} node - 要检查的DOM节点
   * @returns {boolean} - 是否为消息元素
   */
  isMessageElement(node) {
    throw new Error('子类必须实现 isMessageElement 方法');
  }

  /**
   * 从页面提取标题（可选实现）
   * @returns {string|null} - 提取的标题或null
   */
  extractTitle() {
    return null;
  }

  /**
   * 初始化适配器
   */
  init() {
    if (this.isValidConversationUrl(this.pageUrl)) {
      setTimeout(() => {
        this.initAdapter();
      }, 100);
    } else {
      console.log(`Keep AI Memory: 当前页面不是有效的${this.platform}对话页面`);
    }
  }

  /**
   * 初始化适配器核心逻辑
   * @param {Object} options - 初始化选项
   */
  initAdapter(options = {}) {
    if (this.contentObserver) {
      console.log('Keep AI Memory: 断开之前的内容观察器');
      this.contentObserver.disconnect();
      this.contentObserver = null;
    }

    this.pageUrl = options.url || window.location.href;
    const extractedConversationId = options.conversationId;
    const isNewConversation = options.isNewConversation;
    
    console.log(`Keep AI Memory: 初始化适配器 - URL: ${this.pageUrl}`);
    console.log(`Keep AI Memory: 对话ID: ${extractedConversationId || '未提取'}`);
    console.log(`Keep AI Memory: 是否新对话: ${isNewConversation || false}`);
    
    const cleanUrl = this.pageUrl.split('?')[0];
    const urlKey = `${this.platform}_${cleanUrl}`;
    if (this.currentUrlKey !== urlKey) {
      this.isCreatingConversation = false;
      this.creationPromise = null;
      this.currentUrlKey = urlKey;
    }
    
    this.connectToDatabase()
      .then(() => {
        if (window.keepAIMemorySettings && window.keepAIMemorySettings.autoSave) {
          return this.findOrCreateConversation();
        }
        return this.findConversation();
      })
      .then((conversationId) => {
        if (!conversationId) {
          console.log('Keep AI Memory: No conversation ID found or created. Halting initialization.');
          return Promise.reject('No conversation ID');
        }
        this.currentConversationId = conversationId;
        console.log('当前会话ID:', this.currentConversationId);
        
        if (window.keepAIMemorySettings && window.keepAIMemorySettings.autoSave) {
          console.log('Keep AI Memory: 自动保存模式 - 执行初始保存');
          return this.saveAllMessages();
        } else {
          console.log('Keep AI Memory: 手动保存模式 - 跳过初始保存');
          return Promise.resolve();
        }
      })
      .then((saveResult) => {
        if (!this.currentConversationId) return;
        
        if (window.keepAIMemorySettings && window.keepAIMemorySettings.autoSave) {
          console.log('Keep AI Memory: 自动保存模式 - 设置内容变化监听器');
          this.contentObserver = this.setupMutationObserver();
        } else {
          console.log('Keep AI Memory: 手动保存模式 - 不设置自动监听器');
        }
      })
      .catch(error => {
        if (error !== 'No conversation ID') {
          console.error('Keep AI Memory: Initialization failed:', error);
        }
      });
  }



  /**
   * 连接到数据库
   * @returns {Promise<void>}
   */
  async connectToDatabase() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({type: 'connectDB'}, (response) => {
        if (response && response.status === 'ok') {
          console.log('Keep AI Memory: 数据库连接成功');
          resolve();
        } else {
          console.error('Keep AI Memory: 数据库连接失败', response?.error || '未知错误');
          reject('数据库连接失败');
        }
      });
    });
  }

  /**
   * 仅查找会话，不创建新会话
   * @returns {Promise<string|null>} 会话ID或null
   */
  async findConversation() {
    return new Promise((resolve, reject) => {
      const conversationId = this.lastKnownConversationId;
      
      if (conversationId && !conversationId.startsWith('new_conversation_')) {
        console.log(`Keep AI Memory: 使用对话ID查询会话: ${conversationId}`);
        chrome.runtime.sendMessage({
          type: 'findConversationById',
          conversationId: conversationId
        }, async (response) => {
          if (response && response.conversation) {
            console.log(`Keep AI Memory: 通过ID找到会话: ${response.conversation.conversationId}`);
            resolve(response.conversation.conversationId);
        return;
          }
          this.fallbackToUrlSearch(resolve);
        });
    } else {
        this.fallbackToUrlSearch(resolve);
      }
    });
  }

  /**
   * 回退到URL查询的函数
   */
  fallbackToUrlSearch(resolve) {
    const cleanUrl = this.pageUrl.split('?')[0];
    console.log(`Keep AI Memory: 回退到URL查询: ${cleanUrl}`);
      
      chrome.runtime.sendMessage({
        type: 'findConversationByUrl',
        url: cleanUrl
    }, async (response) => {
      if (response && response.conversation) {
        console.log(`Keep AI Memory: 通过URL找到会话: ${response.conversation.conversationId}`);
          resolve(response.conversation.conversationId);
        } else {
        console.log('Keep AI Memory: 未找到会话，不创建新会话');
          resolve(null);
        }
    });
  }

    /**
   * 查找或创建会话
   * @returns {Promise<string|null>} 会话ID或null
   */
  async findOrCreateConversation() {
    // 生成当前URL的唯一键
    const cleanUrl = this.pageUrl.split('?')[0];
    const urlKey = `${this.platform}_${cleanUrl}`;
    
    // 如果正在为同一URL创建对话，返回现有的Promise
    if (this.isCreatingConversation && this.currentUrlKey === urlKey && this.creationPromise) {
      console.log(`Keep AI Memory: 正在为URL创建对话，等待现有操作完成: ${cleanUrl}`);
      return this.creationPromise;
    }
    
    // 如果URL发生变化，重置创建状态
    if (this.currentUrlKey !== urlKey) {
      this.isCreatingConversation = false;
      this.creationPromise = null;
      this.currentUrlKey = urlKey;
    }
    
    // 设置创建锁
    this.isCreatingConversation = true;
    this.currentUrlKey = urlKey;
    
    this.creationPromise = new Promise((resolve, reject) => {
      const attemptExtraction = (retryCount = 0) => {
        const messages = this.extractMessages();
        
        if (messages.length === 0 && retryCount < 3) {
          console.log(`Keep AI Memory: 页面暂无消息内容，${1000 * (retryCount + 1)}ms后重试 (${retryCount + 1}/3)`);
          setTimeout(() => attemptExtraction(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        
        if (messages.length === 0) {
          console.log('Keep AI Memory: 页面无消息内容，不创建新对话');
          this.isCreatingConversation = false;
          this.creationPromise = null;
          resolve(null);
      return;
    }

        this.processConversation(messages, resolve, reject);
      };
      
      attemptExtraction();
    });
    
    // 处理Promise完成后的清理
    this.creationPromise.finally(() => {
      this.isCreatingConversation = false;
      this.creationPromise = null;
    });
    
    return this.creationPromise;
  }

  /**
   * 处理对话的核心逻辑
   */
  processConversation(messages, resolve, reject) {
    const conversationId = this.lastKnownConversationId;
    const isNewConversation = conversationId && conversationId.startsWith('new_conversation_');
    
    if (conversationId && !isNewConversation) {
      console.log(`Keep AI Memory: 使用对话ID查询会话: ${conversationId}`);
      chrome.runtime.sendMessage({
        type: 'findConversationById',
        conversationId: conversationId
      }, async (response) => {
        if (response && response.conversation) {
          console.log(`Keep AI Memory: 通过ID找到会话: ${response.conversation.conversationId}`);
          resolve(response.conversation.conversationId);
          return;
        }
        this.fallbackToUrlSearchForCreate(messages, resolve, reject);
      });
    } else {
      this.fallbackToUrlSearchForCreate(messages, resolve, reject);
    }
  }

  /**
   * 创建新会话的URL查询回退
   */
  fallbackToUrlSearchForCreate(messages, resolve, reject) {
    const cleanUrl = this.pageUrl.split('?')[0];
    console.log(`Keep AI Memory: 回退到URL查询: ${cleanUrl}`);
      
      chrome.runtime.sendMessage({
        type: 'findConversationByUrl',
        url: cleanUrl
    }, async (response) => {
      if (response && response.conversation) {
        console.log(`Keep AI Memory: 通过URL找到会话: ${response.conversation.conversationId}`);
          resolve(response.conversation.conversationId);
        } else {
        // 在创建新对话前再次检查，防止竞争条件
        this.doubleCheckBeforeCreate(messages, cleanUrl, resolve, reject);
      }
    });
  }

  /**
   * 创建前双重检查，防止竞争条件
   */
  doubleCheckBeforeCreate(messages, cleanUrl, resolve, reject) {
    console.log(`Keep AI Memory: 创建前双重检查URL: ${cleanUrl}`);
    
    chrome.runtime.sendMessage({
      type: 'findConversationByUrl',
      url: cleanUrl
    }, async (response) => {
      if (response && response.conversation) {
        console.log(`Keep AI Memory: 双重检查找到现有会话: ${response.conversation.conversationId}`);
        resolve(response.conversation.conversationId);
      } else {
        console.log(`Keep AI Memory: 确认需要创建新会话: ${cleanUrl}`);
        this.createNewConversation(messages, cleanUrl, resolve, reject);
      }
    });
  }

  /**
   * 创建新会话
   */
  async createNewConversation(messages, cleanUrl, resolve, reject) {
    const title = this.extractTitle() || this.generateTitleFromMessages(messages);

    const conversation = {
      link: cleanUrl,
      title: title,
      platform: this.platform,
      messages: messages,
      externalId: this.lastKnownConversationId || null
    };

    console.log(`Keep AI Memory: 创建新对话，包含消息数量: ${messages.length}`);
    
    try {
      const conversationId = await new Promise((resolveCreate, rejectCreate) => {
      chrome.runtime.sendMessage({
        type: 'createConversation',
        conversation: conversation
        }, (createResponse) => {
          if (createResponse && createResponse.conversationId) {
          if (window.keepAIMemoryCommon) {
            window.keepAIMemoryCommon.showSuccessStatus();
          }
            console.log(`Keep AI Memory: 成功创建新会话: ${createResponse.conversationId}`);
            resolveCreate(createResponse.conversationId);
        } else {
            console.error('Keep AI Memory: 创建会话失败', createResponse?.error || '未知错误');
            rejectCreate('创建会话失败');
        }
      });
    });
      
      resolve(conversationId);
    } catch (error) {
      console.error('Keep AI Memory: 创建对话失败:', error);
      reject(error);
    }
  }

  /**
   * 从消息中生成标题
   */
  generateTitleFromMessages(messages) {
    const firstUserMessage = messages.find(m => m.sender === 'user');
    if (firstUserMessage) {
      const text = firstUserMessage.content;
      return text.length > 50 ? text.substring(0, 50) + '...' : text;
    }
    return '新对话';
  }

  // ========== DOM监听逻辑 ==========

  /**
   * 设置DOM变化监听
   */
  setupMutationObserver() {
    console.log('Keep AI Memory: Setting up content observer.');
    
    this.updateCurrentMessagesMap();
    
    const observer = new MutationObserver((mutations) => {
      if (window.keepAIMemorySettings && !window.keepAIMemorySettings.autoSave) {
        return;
      }
      
      let hasRelevantChanges = false;
      
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // 检查新增的节点
        for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && this.isMessageElement(node)) {
              hasRelevantChanges = true;
              break;
            }
          }
        
        // 检查删除的节点
        if (!hasRelevantChanges) {
          for (const node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && this.isMessageElement(node)) {
              hasRelevantChanges = true;
              break;
            }
          }
        }
        } else if (mutation.type === 'characterData' || mutation.type === 'childList') {
          let targetNode = mutation.target;
          while (targetNode && targetNode !== document.body) {
            if (this.isMessageElement(targetNode)) {
              hasRelevantChanges = true;
              break;
            }
            targetNode = targetNode.parentNode;
          }
        }
        if (hasRelevantChanges) break;
      }
      
      if (hasRelevantChanges) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.checkForActualMessageChanges();
        }, this.DEBOUNCE_DELAY);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true
    });

    return observer;
  }

  /**
   * 更新当前消息映射
   */
  updateCurrentMessagesMap() {
    const messages = this.extractMessages();
    const newMap = new Map();
    
    messages.forEach(message => {
      newMap.set(message.messageId, message.content);
    });
    
    this.currentMessagesMap = newMap;
    return messages;
  }

  /**
   * 检查当前所有消息与上次比较，判断是否有变化
   */
  async checkForActualMessageChanges() {
    if (!window.keepAIMemorySettings || !window.keepAIMemorySettings.autoSave) {
      return;
    }
    
    const currentUrl = window.location.href;
    if (!this.isValidConversationUrl(currentUrl)) {
      console.log('Keep AI Memory: 当前URL不是有效的对话页面，跳过保存');
        return;
      }

    if (!this.currentConversationId) {
        return;
      }

    console.log('检查消息实际变化...');
    
    const currentMessages = this.extractMessages();
    
    if (currentMessages.length === 0) {
      return;
    }
    
    const messagesForComparison = currentMessages.map(msg => {
      const { timestamp, ...rest } = msg;
      return rest;
    });
    const currentMessagesJson = JSON.stringify(messagesForComparison);
    
    if (this.lastMessagesJson === currentMessagesJson) {
      console.log('消息内容无变化，跳过保存');
      return;
    }
    
    this.lastMessagesJson = currentMessagesJson;
    console.log('检测到消息变化，触发保存');
    
    this.updateCurrentMessagesMap();
    await this.checkForNewMessages();
  }

  /**
   * 检查新消息
   */
  async checkForNewMessages() {
    if (this.isChecking) return;
    
    if (!window.keepAIMemorySettings || !window.keepAIMemorySettings.autoSave) {
      return;
    }
    
    if (!this.currentConversationId) {
      try {
        this.isChecking = true;
        console.log('自动保存模式，首次创建对话');
        const convId = await this.findOrCreateConversation();
        this.currentConversationId = convId;
      } catch (error) {
        console.error('创建会话失败:', error);
      } finally {
        this.isChecking = false;
      }
      return;
    }
    
    this.isChecking = true;
    
    try {
      await this.saveAllMessages();
    } catch (error) {
      console.error('检查新消息失败:', error);
    } finally {
      this.isChecking = false;
    }
  }

  // ========== 保存逻辑 ==========

  /**
   * 处理手动保存按钮点击事件
   */
  async handleManualSave() {
    console.log('Keep AI Memory: 手动保存按钮被点击');
    
    const currentUrl = window.location.href;
    if (!this.isValidConversationUrl(currentUrl)) {
      console.log(`Keep AI Memory: 当前页面不是有效的${this.platform}对话页面，无法保存`);
      return;
    }
    
    try {
      const { conversationId, isNewConversation } = this.extractConversationInfo(currentUrl);
      
      if (conversationId) {
        this.lastKnownConversationId = conversationId;
      }
      
      await this.connectToDatabase();
      
      const foundConversationId = await this.findOrCreateConversation();
      
      if (!foundConversationId) {
        console.log('Keep AI Memory: 手动保存 - 无法找到或创建对话');
        return;
      }
      
      this.currentConversationId = foundConversationId;
      console.log('Keep AI Memory: 手动保存 - 当前会话ID:', this.currentConversationId);
      
      await this.saveAllMessages();
      
      console.log('Keep AI Memory: 手动保存完成');
      
    } catch (error) {
      console.error('Keep AI Memory: 手动保存失败:', error);
      
      if (window.keepAIMemoryCommon) {
        window.keepAIMemoryCommon.showErrorStatus();
      }
    }
  }

  /**
   * 保存所有消息
   */
  async saveAllMessages() {
    try {
      if (!this.currentConversationId) {
        console.log('未找到会话ID，无法保存');
        return;
      }
      
      const attemptSave = async (retryCount = 0) => {
        const messages = this.extractMessages();
        console.log(`提取到消息数量: ${messages.length}`);
        
        if (messages.length === 0 && retryCount < 2) {
          console.log(`Keep AI Memory: 保存时暂无消息，${500 * (retryCount + 1)}ms后重试 (${retryCount + 1}/2)`);
          setTimeout(() => attemptSave(retryCount + 1), 500 * (retryCount + 1));
          return;
        }

        if (messages.length === 0) {
          console.log('没有消息内容，跳过保存');
          return;
        }

        // 检查核心组件是否加载完成
        if (!this.compatibility || !this.storageManager) {
          console.error('Keep AI Memory: 核心组件未加载，无法保存消息');
          console.error('Keep AI Memory: StorageManager:', !!this.storageManager, 'Compatibility:', !!this.compatibility);
          return;
        }
        
        // 使用智能增量更新
        await this.performIncrementalSave();
      };
      
      await attemptSave();
    } catch (error) {
      console.error('保存消息失败:', error);
    }
  }

  /**
   * 解耦后的增量保存逻辑（懒加载感知）
   */
  async performIncrementalSave() {
    const currentMessages = this.extractMessages();
    
    // 使用智能增量更新（内置锚点失败时的简单追加策略）
    const result = await this.storageManager.smartIncrementalUpdate(
      this.currentConversationId, 
      currentMessages
    );
    
    if (result && result.success) {
      console.log('Keep AI Memory: 智能增量更新完成');
      if (window.keepAIMemoryCommon) {
        window.keepAIMemoryCommon.showSuccessStatus();
      }
    } else {
      console.error('Keep AI Memory: 智能增量更新失败', result);
    }
  }



  /**
   * 检查是否有变化
   * @param {Object} changes - 变化对象
   * @returns {boolean} 是否有变化
   */
  hasChanges(changes) {
    return changes.newMessages.length > 0 || 
           changes.updatedMessages.length > 0 || 
           changes.removedMessages.length > 0;
  }

  /**
   * 获取已存储的消息
   * @returns {Promise<Array>} 已存储的消息数组
   */
  async getStoredMessages() {
    if (!this.storageManager) {
      return [];
    }

    try {
      const conversation = await this.storageManager.getConversation(this.currentConversationId);
      return conversation ? conversation.messages || [] : [];
    } catch (error) {
      console.error('Keep AI Memory: 获取存储消息失败', error);
      return [];
    }
  }



  // ========== 工具方法 ==========

  /**
   * 生成消息唯一ID
   */
  generateMessageId(sender, content, index) {
    return `msg_${sender}_position_${index}`;
  }



  /**
   * 提取格式化内容的所有可见文本
   */
  extractFormattedContent(element) {
    if (!element) return '';
    
    const text = element.innerText || element.textContent || '';
    return text.trim().replace(/\n\s*\n\s*\n/g, '\n\n');
  }

  // ========== URL监控逻辑 ==========

  /**
   * 启动URL监控
   */
  startUrlWatcher() {
    console.log('Keep AI Memory: URL瞭望员启动');
    
    if (this.urlCheckInterval) clearInterval(this.urlCheckInterval);

    this.handleUrlCheck();
    this.urlCheckInterval = setInterval(() => this.handleUrlCheck(), 1000);
  }

  /**
   * 检查URL变化并广播事件
   */
  handleUrlCheck() {
    const currentUrl = window.location.href;
    const currentBaseUrl = currentUrl.split('?')[0];
    
    if (!this.isValidConversationUrl(currentUrl)) {
      return;
    }
    
    const { conversationId, isNewConversation } = this.extractConversationInfo(currentUrl);
    
    if (!conversationId) {
        return;
      }
      
    if (currentBaseUrl !== this.lastKnownUrl || conversationId !== this.lastKnownConversationId) {
      console.log(`Keep AI Memory: 检测到变化 - 新URL: ${currentBaseUrl}`);
      console.log(`Keep AI Memory: 对话ID变化: ${this.lastKnownConversationId || '无'} -> ${conversationId || '无'}`);
      
      this.lastKnownUrl = currentBaseUrl;
      this.lastKnownConversationId = conversationId;
      
      window.dispatchEvent(new CustomEvent('keep-ai-memory-url-changed', {
        detail: {
          url: currentUrl,
        conversationId: conversationId,
          isNewConversation: isNewConversation
        }
      }));
    }
  }

  // ========== 事件监听设置 ==========

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 手动保存监听器
    window.removeEventListener('keep-ai-memory-manual-save', this.handleManualSave.bind(this));
    window.addEventListener('keep-ai-memory-manual-save', this.handleManualSave.bind(this));
    
    // URL变化监听器
    window.addEventListener('keep-ai-memory-url-changed', (event) => {
      console.log('Keep AI Memory: 行动组收到URL变化事件');
      
      const { url, conversationId, isNewConversation } = event.detail;
      
      if (url && this.isValidConversationUrl(url) && conversationId) {
        setTimeout(() => {
          this.initAdapter({
            url: url,
            conversationId: conversationId,
            isNewConversation: isNewConversation
          });
        }, 100);
      }
    });

    // 设置更新监听器
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'settingsUpdated' && message.settings) {
        window.keepAIMemorySettings = Object.assign({}, window.keepAIMemorySettings, message.settings);
        console.log(`Keep AI Memory: ${this.platform}适配器收到设置更新`, message.settings);
        console.log('Keep AI Memory: 设置已更新，悬浮标签状态将自动同步');
      }
      sendResponse({status: 'ok'});
      return true;
    });
  }

  /**
   * 设置页面卸载检测
   */
  setupPageUnloadDetection() {
    let isUnloading = false;
    window.addEventListener('beforeunload', function() { isUnloading = true; });
    window.keepAIMemory = Object.assign(window.keepAIMemory || {}, {
      isPageUnloading: () => isUnloading
    });
  }

  // ========== 启动逻辑 ==========

  /**
   * 初始启动
   */
  initialBoot() {
    if (window.keepAIMemorySettings) {
      this.startUrlWatcher();
    } else {
      setTimeout(() => this.initialBoot(), 100);
    }
  }

  /**
   * 启动适配器
   */
  start() {
    this.init();
    this.setupEventListeners();
    this.setupPageUnloadDetection();
    this.initialBoot();
  }

  /**
   * 检查是否处于编辑状态
   */
  isInEditMode(element) {
    if (!element) return false;
    const activeTextarea = element.querySelector('textarea:focus');
    return !!activeTextarea;
  }
}

// 导出基类
window.BasePlatformAdapter = BasePlatformAdapter;