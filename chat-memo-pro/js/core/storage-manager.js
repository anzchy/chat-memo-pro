/**
 * === STORAGE MANAGER 组件生态系统 ===
 * 
 * 职责分工说明：
 * - ChromeStorageAdapter: Chrome API抽象层
 * - CacheManager: 专业缓存管理（与compatibility.js缓存不冲突）
 * - MessageProcessor: 消息合并逻辑（委托给compatibility.js处理核心逻辑）
 * - AnchorDetector: 懒加载锚点算法
 * - StorageManager: 组件协调器
 * 
 * 注意：消息标准化和变化检测的核心逻辑在 compatibility.js 中统一处理，
 * 这里只保留必要的委托接口和紧急降级方案。
 */

/**
 * Chrome API 适配器 - 抽象存储层
 */
class ChromeStorageAdapter {
  /**
   * 发送Chrome API消息（统一错误处理）
   * @param {Object} message - 消息对象
   * @returns {Promise} API响应
   */
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const error = new Error(chrome.runtime.lastError.message);
          console.error('Keep AI Memory: Chrome API错误', error.message);
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }

  /**
   * 获取对话数据
   * @param {string} conversationId - 对话ID
   * @returns {Promise<Object>} 对话数据
   */
  async getConversation(conversationId) {
    const response = await this.sendMessage({
      type: 'getConversationById',
      conversationId: conversationId
    });
    
    return response?.conversation || null;
  }

  /**
   * 保存对话数据
   * @param {Object} conversation - 对话对象
   * @returns {Promise<Object>} 保存结果
   */
  async saveConversation(conversation) {
    const response = await this.sendMessage({
      type: 'updateConversation',
      conversation: conversation
    });
    
    if (response?.status === 'ok') {
      return response;
    } else {
      throw new Error('保存失败');
    }
  }
}

/**
 * 缓存管理器 - 专注缓存逻辑
 */
class CacheManager {
  constructor(maxSize = 100, expiry = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.expiry = expiry;
    this.cleanupInterval = null;
    this.startPeriodicCleanup();
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {*} 缓存值或null
   */
  get(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.expiry) {
      return cached.data;
    }
    return null;
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {*} data - 缓存数据
   */
  set(key, data) {
    this.cleanupExpired();
    this.enforceMaxSize();
    
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 清理过期缓存
   */
  cleanupExpired() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.expiry) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log('Keep AI Memory: 清理过期缓存', expiredKeys.length, '个条目');
    }
  }

  /**
   * 强制执行最大缓存大小
   */
  enforceMaxSize() {
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        console.log('Keep AI Memory: 缓存超限，删除最旧条目:', oldestKey);
      } else {
        break;
      }
    }
  }

  /**
   * 启动定期清理
   */
  startPeriodicCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  /**
   * 停止定期清理
   */
  stopPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 获取缓存统计
   * @returns {Object} 统计信息
   */
  getStats() {
    const now = Date.now();
    const expiredEntries = Array.from(this.cache.entries()).filter(
      ([, cached]) => now - cached.timestamp > this.expiry
    );

    return {
      totalEntries: this.cache.size,
      expiredEntries: expiredEntries.length,
      validEntries: this.cache.size - expiredEntries.length
    };
  }

  /**
   * 销毁缓存管理器
   */
  destroy() {
    this.stopPeriodicCleanup();
    this.clear();
  }
}

/**
 * 消息处理器 - 专注消息业务逻辑
 * 注意：消息标准化和变化检测逻辑已迁移到 compatibility.js 统一处理
 */
class MessageProcessor {
  constructor(compatibility = null) {
    this.compatibility = compatibility;
  }

  /**
   * 标准化消息对象（委托给compatibility处理）
   * @param {Object} message - 消息对象
   * @returns {Object} 标准化后的消息对象
   */
  normalizeMessage(message) {
    if (!this.compatibility) {
      console.error('Keep AI Memory: Compatibility组件未加载，无法标准化消息');
      throw new Error('Compatibility组件未加载');
    }
    
    return this.compatibility.normalizeMessage(message);
  }

  /**
   * 处理消息变化（委托给compatibility处理）
   * @param {Array} currentMessages - 当前消息
   * @param {Array} storedMessages - 存储消息
   * @returns {Object} 变化对象
   */
  processChanges(currentMessages, storedMessages) {
    if (!this.compatibility) {
      console.error('Keep AI Memory: Compatibility组件未加载，无法进行变化检测');
      throw new Error('Compatibility组件未加载');
    }
    
    return this.compatibility.processMessageChanges(currentMessages, storedMessages);
  }

  /**
   * 合并变化到消息列表
   */
  mergeChanges(messages, changes) {
    let result = [...messages];
    
    // 删除
    if (changes.removedMessages.length) {
      const removedIds = new Set(changes.removedMessages.map(m => m.messageId));
      result = result.filter(m => !removedIds.has(m.messageId));
    }
    
    // 更新
    if (changes.updatedMessages.length) {
      const updateMap = new Map(changes.updatedMessages.map(m => [m.messageId, m]));
      result = result.map(m => updateMap.get(m.messageId) || m);
    }
    
    // 新增
    if (changes.newMessages.length) {
      result.push(...changes.newMessages.map(m => this.normalizeMessage(m)));
    }
    
    return result;
  }
}

/**
 * 锚点检测器 - 专注懒加载锚点逻辑
 */
class AnchorDetector {
  /**
   * 头部锚点匹配（性能优化版）
   * @param {Array} currentMessages - 当前页面消息
   * @param {Array} storedMessages - 存储消息
   * @returns {Object} 锚点信息
   */
  findHeadAnchor(currentMessages, storedMessages) {
    if (!currentMessages.length || !storedMessages.length) {
      return { found: false };
    }
    
    // 预计算存储消息的指纹，避免重复计算
    const storedFingerprints = storedMessages.map(msg => 
      `${msg.sender}:${msg.content.substring(0, 100)}`
    );
    
    const anchorSize = Math.min(6, currentMessages.length);
    
    // 从大到小尝试不同的锚点大小
    for (let size = anchorSize; size >= 1; size--) {
      const anchor = currentMessages.slice(0, size).map(msg => 
        `${msg.sender}:${msg.content.substring(0, 100)}`
      );
      
      // 使用字符串连接进行快速匹配，避免嵌套循环
      const anchorString = anchor.join('|');
      
      for (let i = 0; i <= storedFingerprints.length - size; i++) {
        const storedString = storedFingerprints.slice(i, i + size).join('|');
        
        if (storedString === anchorString) {
          console.log(`Keep AI Memory: 锚点匹配成功 (size=${size}, position=${i})`);
          return { found: true, position: i, size, protectedCount: i };
        }
      }
    }
    
    return { found: false };
  }

  /**
   * 修正消息ID（锚点匹配成功时）
   * @param {Array} currentMessages - 当前页面消息
   * @param {number} anchorPosition - 锚点在存储中的位置
   * @returns {Array} 修正后的消息
   */
  correctMessageIds(currentMessages, anchorPosition) {
    console.log('Keep AI Memory: 修正消息ID以避免重复保存');
    
    return currentMessages.map((message, index) => {
      const correctedPosition = anchorPosition + index;
      // 使用统一的ID生成规则，避免重复实现
      const correctedMessageId = `msg_${message.sender}_position_${correctedPosition}`;
      
      return {
        ...message,
        position: correctedPosition,
        messageId: correctedMessageId
      };
    });
  }
}

/**
 * 存储管理器 - 协调器模式，整合各个组件
 * 解耦存储逻辑与业务逻辑的核心组件
 */
class StorageManager {
  constructor() {
    // 组件依赖注入（支持测试时的mock）
    this.storageAdapter = new ChromeStorageAdapter();
    this.cacheManager = new CacheManager();
    this.messageProcessor = new MessageProcessor(
      typeof Compatibility !== 'undefined' ? new Compatibility() : null
    );
    this.anchorDetector = new AnchorDetector();
    
    // 批量操作管理
    this.batchQueue = [];
    this.batchTimeout = null;
    this.batchDelay = 100;
  }

  /**
   * 增量更新对话
   * @param {string} conversationId - 对话ID
   * @param {Object} changes - 变化对象
   * @returns {Promise} 更新结果
   */
  async incrementalUpdate(conversationId, changes) {
    console.log('Keep AI Memory: 开始增量更新', {
      conversationId,
      changes: {
        new: changes.newMessages.length,
        updated: changes.updatedMessages.length,
        removed: changes.removedMessages.length
      }
    });

    // 检查是否有真正的变化
    const hasRealChanges = changes && (
      changes.newMessages.length > 0 || 
      changes.updatedMessages.length > 0 || 
      changes.removedMessages.length > 0
    );
    
    if (!hasRealChanges) {
      console.log('Keep AI Memory: 没有消息变化，跳过增量更新');
      const conversation = await this.getConversation(conversationId);
      return { success: true, conversation, skipped: true };
    }

    try {
      // 获取对话数据
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation) {
        throw new Error(`对话不存在: ${conversationId}`);
      }

      // 应用增量变化（委托给消息处理器）
      this.applyChanges(conversation, changes);
      
      // 更新元数据
      this.updateMetadata(conversation, changes);
      
      // 保存更新（委托给存储适配器）
      await this.storageAdapter.saveConversation(conversation);
      
      // 更新缓存（委托给缓存管理器）
      this.cacheManager.set(conversationId, conversation);
      
      console.log('Keep AI Memory: 增量更新完成');
      
      return { success: true, conversation };
    } catch (error) {
      console.error('Keep AI Memory: 增量更新失败', error);
      throw error;
    }
  }

  /**
   * 获取对话数据（带缓存）
   * @param {string} conversationId - 对话ID
   * @returns {Promise<Object>} 对话数据
   */
  async getConversation(conversationId) {
    // 尝试从缓存获取
    const cached = this.cacheManager.get(conversationId);
    if (cached) {
      console.log('Keep AI Memory: 从缓存获取对话', conversationId);
      return cached;
    }

    // 从存储获取
    console.log('Keep AI Memory: 从数据库获取对话', conversationId);
    const conversation = await this.storageAdapter.getConversation(conversationId);
    
    if (conversation) {
      this.cacheManager.set(conversationId, conversation);
    }
    
    return conversation;
  }

  /**
   * 应用变化到对话（委托给消息处理器）
   * @param {Object} conversation - 对话对象
   * @param {Object} changes - 变化对象
   */
  applyChanges(conversation, changes) {
    if (!conversation.messages) {
      conversation.messages = [];
    }

    // 委托给消息处理器
    conversation.messages = this.messageProcessor.mergeChanges(conversation.messages, changes);
    
    // 按位置排序
    conversation.messages.sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  /**
   * 更新对话元数据
   * @param {Object} conversation - 对话对象
   * @param {Object} changes - 变化对象，用于判断是否需要更新时间
   */
  updateMetadata(conversation, changes = null) {
    // 只有当有真正的内容变化时才更新对话的updatedAt
    const hasRealChanges = changes && (
      changes.newMessages.length > 0 || 
      changes.updatedMessages.length > 0 || 
      changes.removedMessages.length > 0
    );
    
    if (hasRealChanges) {
      conversation.updatedAt = new Date().toISOString();
    }
    
    // 更新消息数量
    conversation.messageCount = conversation.messages.length;

    // 更新最后消息时间
    if (conversation.messages.length > 0) {
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      conversation.lastMessageAt = lastMessage.updatedAt || lastMessage.timestamp;
    }

    // 生成标题（如果不存在）
    if (!conversation.title) {
      const firstUserMessage = conversation.messages.find(m => m.sender === 'user');
      if (firstUserMessage) {
        const text = firstUserMessage.content;
        conversation.title = text.length > 50 ? text.substring(0, 50) + '...' : text;
      }
    }
  }

  // 保存对话方法已移至storageAdapter，此处保留向后兼容
  async saveConversation(conversation) {
    return this.storageAdapter.saveConversation(conversation);
  }

  // 缓存对话方法已移至cacheManager，此处保留向后兼容
  cacheConversation(conversationId, conversation) {
    this.cacheManager.set(conversationId, conversation);
  }

  /**
   * 批量操作优化
   * @param {Array} updates - 更新操作数组
   * @returns {Promise} 批量操作结果
   */
  async batchUpdate(updates) {
    console.log('Keep AI Memory: 开始批量更新', updates.length, '个操作');

    const results = [];
    
    for (const update of updates) {
      try {
        const result = await this.incrementalUpdate(update.conversationId, update.changes);
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    console.log('Keep AI Memory: 批量更新完成', {
      total: updates.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    return results;
  }

  /**
   * 添加批量操作到队列
   * @param {Object} update - 更新操作
   */
  queueBatchUpdate(update) {
    this.batchQueue.push(update);
    
    // 清除现有定时器
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    // 设置新的定时器
    this.batchTimeout = setTimeout(() => {
      this.processBatchQueue();
    }, this.batchDelay);
  }

  /**
   * 销毁实例，清理资源
   */
  destroy() {
    // 清理定时器
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    // 委托给各组件进行清理
    this.cacheManager.destroy();
    this.batchQueue = [];
    
    console.log('Keep AI Memory: StorageManager已销毁');
  }

  /**
   * 处理批量操作队列
   */
  async processBatchQueue() {
    if (this.batchQueue.length === 0) {
      return;
    }

    const updates = [...this.batchQueue];
    this.batchQueue = [];
    
    await this.batchUpdate(updates);
  }

  // 缓存操作方法委托给cacheManager
  clearCache(conversationId = null) {
    if (conversationId) {
      this.cacheManager.delete(conversationId);
    } else {
      this.cacheManager.clear();
    }
  }

  getCacheStats() {
    return {
      ...this.cacheManager.getStats(),
      batchQueueSize: this.batchQueue.length
    };
  }

  // ==================== 懒加载感知更新 ====================

  /**
   * 智能增量更新（懒加载感知）
   * @param {string} conversationId - 对话ID
   * @param {Array} currentMessages - 当前页面消息
   * @returns {Promise} 更新结果
   */
  async smartIncrementalUpdate(conversationId, currentMessages) {
    if (!currentMessages || !Array.isArray(currentMessages)) {
      throw new Error('currentMessages must be a valid array');
    }
    
    const conversation = await this.getConversation(conversationId);
    const storedMessages = conversation?.messages || [];
    
    // 新对话或当前无消息：全量处理
    if (!storedMessages.length) {
      return this.saveNewConversation(conversationId, currentMessages, conversation);
    }
    
    if (!currentMessages.length) {
      console.log('Keep AI Memory: 当前页面无消息，跳过更新');
      return { success: true, conversation };
    }
    
    // 已保存对话：锚点匹配（委托给锚点检测器）
    const anchor = this.anchorDetector.findHeadAnchor(currentMessages, storedMessages);
    return this.processWithAnchor(conversation, currentMessages, storedMessages, anchor);
  }

  /**
   * 分区处理
   * @param {Object} conversation - 对话对象
   * @param {Array} currentMessages - 当前页面消息
   * @param {Array} storedMessages - 存储消息
   * @param {Object} anchor - 锚点信息
   * @returns {Promise} 更新结果
   */
  async processWithAnchor(conversation, currentMessages, storedMessages, anchor) {
    // 防止并发修改：为当前操作创建一个操作锁
    const operationId = `${conversation.conversationId}_${Date.now()}`;
    console.log(`Keep AI Memory: 开始处理操作 ${operationId}`);
    
    let protectedZone = [];
    let operationZone = storedMessages;
    let correctedCurrentMessages = currentMessages;
    
    if (anchor.found && anchor.position > 0) {
      console.log(`Keep AI Memory: 保护前 ${anchor.protectedCount} 条懒加载消息`);
      protectedZone = storedMessages.slice(0, anchor.position);
      operationZone = storedMessages.slice(anchor.position);
      
      // 修正当前消息的position和messageId，避免重复保存（委托给锚点检测器）
      correctedCurrentMessages = this.anchorDetector.correctMessageIds(currentMessages, anchor.position);
    } else if (!anchor.found) {
      console.log('Keep AI Memory: 锚点匹配失败，用页面内容全量覆盖存储');
      // 直接用页面内容覆盖存储，确保数据一致性
      conversation.messages = currentMessages.map(msg => this.messageProcessor.normalizeMessage(msg));
      
      // 更新元数据
      this.updateMetadata(conversation);
      
      // 保存覆盖后的对话
      await this.storageAdapter.saveConversation(conversation);
      this.cacheManager.set(conversation.conversationId, conversation);
      
      console.log(`Keep AI Memory: 全量覆盖完成，共 ${conversation.messages.length} 条消息`);
      return { success: true, conversation, anchor: false, operationId, fullOverwrite: true };
    }
    
    try {
      // 处理操作区变化（委托给消息处理器）
      const changes = this.messageProcessor.processChanges(correctedCurrentMessages, operationZone);
      
      // 检查是否有真正的变化
      const hasRealChanges = changes && (
        changes.newMessages.length > 0 || 
        changes.updatedMessages.length > 0 || 
        changes.removedMessages.length > 0
      );
      
      if (!hasRealChanges) {
        console.log(`Keep AI Memory: 没有消息变化，跳过保存 ${operationId}`);
        return { success: true, conversation, anchor: anchor.found, operationId, skipped: true };
      }
      
      // 合并保护区和更新后的操作区（委托给消息处理器）
      conversation.messages = [...protectedZone, ...this.messageProcessor.mergeChanges(operationZone, changes)];
      conversation.messages.sort((a, b) => (a.position || 0) - (b.position || 0));
      
      this.updateMetadata(conversation, changes);
      await this.saveConversation(conversation);
      this.cacheConversation(conversation.conversationId, conversation);
      
      console.log(`Keep AI Memory: 操作完成 ${operationId}`);
      return { success: true, conversation, anchor: anchor.found, operationId };
    } catch (error) {
      console.error(`Keep AI Memory: 操作失败 ${operationId}`, error);
      throw error;
    }
  }

  /**
   * 保存新对话
   */
  async saveNewConversation(conversationId, currentMessages, conversation = null) {
    console.log(`Keep AI Memory: 新对话，全量保存 ${currentMessages.length} 条消息`);
    
    if (!currentMessages.length) {
      console.log('Keep AI Memory: 无消息内容，跳过保存');
      return { success: true, conversation: conversation || { messages: [] } };
    }
    
    const changes = { 
      newMessages: currentMessages, 
      updatedMessages: [], 
      removedMessages: [] 
    };
    return this.incrementalUpdate(conversationId, changes);
  }
}

// 导出类
// 浏览器环境导出
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
  window.ChromeStorageAdapter = ChromeStorageAdapter;
  window.CacheManager = CacheManager;
  window.MessageProcessor = MessageProcessor;
  window.AnchorDetector = AnchorDetector;
}

// Node.js环境导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    StorageManager, 
    ChromeStorageAdapter, 
    CacheManager, 
    MessageProcessor, 
    AnchorDetector 
  };
} 

