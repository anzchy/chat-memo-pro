/**
 * 兼容性处理器 - 统一处理时间、数据和消息变化
 * 提供函数式工具和统一类两种使用方式
 */

/**
 * 时间处理工具函数
 */
const TimeUtils = {
  /**
   * 获取消息的显示时间（兼容新旧格式）
   */
  getMessageTime(message) {
    if (!message) return '';
    
    if (message.createdAt) return message.createdAt;
    if (message.timestamp) return message.timestamp;
    
    return new Date().toISOString();
  },

  /**
   * 获取对话的显示时间（兼容新旧格式）
   */
  getConversationTime(conversation) {
    if (!conversation) return '';
    
    if (conversation.lastMessageAt) return conversation.lastMessageAt;
    if (conversation.createdAt) return conversation.createdAt;
    if (conversation.timestamp) return conversation.timestamp;
    
    return new Date().toISOString();
  },

  /**
   * 获取对话的最后消息时间
   */
  getLastMessageTime(conversation) {
    if (!conversation || !conversation.messages || conversation.messages.length === 0) {
      return TimeUtils.getConversationTime(conversation);
    }

    const lastMessage = conversation.messages[conversation.messages.length - 1];
    return TimeUtils.getMessageTime(lastMessage);
  },

  /**
   * 验证时间字符串是否有效
   */
  isValidTimeString(timeString) {
    if (!timeString) return false;
    
    try {
      const date = new Date(timeString);
      return !isNaN(date.getTime());
    } catch (error) {
      return false;
    }
  },

  /**
   * 标准化时间字符串
   */
  normalizeTimeString(timeString) {
    if (!TimeUtils.isValidTimeString(timeString)) {
      return new Date().toISOString();
    }
    
    return new Date(timeString).toISOString();
  }
};

const DataUtils = {
  hashContent(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString(36);
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36);
  },

  generateFallbackMessageId(message) {
    const sender = message.sender || 'unknown';
    const content = message.content || '';
    const position = message.position || 0;
    const hash = DataUtils.hashContent(content.substring(0, 50));
    
    return `msg_${sender}_pos${position}_${hash}`;
  }
};

/**
 * 数据迁移适配器 - 专门处理数据格式迁移
 */
class DataMigrationAdapter {
  constructor() {
    this.version = 2;
  }

  /**
   * 标准化消息对象
   */
  normalizeMessage(message) {
    if (!message) return message;

    const normalized = { ...message };
    const now = new Date().toISOString();

    if (message.timestamp && !message.createdAt) {
      normalized.createdAt = message.timestamp;
    } else if (!message.createdAt) {
      normalized.createdAt = now;
    }

    if (message.updatedAt) {
      normalized.updatedAt = message.updatedAt;
    } else {
      normalized.updatedAt = message.createdAt || now;
    }

    if (normalized.timestamp) {
      delete normalized.timestamp;
    }

    if (!normalized.messageId) {
      normalized.messageId = DataUtils.generateFallbackMessageId(message);
    }

    return normalized;
  }

  /**
   * 标准化对话对象
   */
  normalizeConversation(conversation) {
    if (!conversation) return conversation;

    const normalized = { ...conversation };
    const now = new Date().toISOString();

    if (conversation.createdAt) {
      normalized.createdAt = conversation.createdAt;
    } else {
      normalized.createdAt = now;
    }

    if (conversation.updatedAt) {
      normalized.updatedAt = conversation.updatedAt;
    } else {
      normalized.updatedAt = conversation.createdAt || now;
    }

    if (conversation.messages && Array.isArray(conversation.messages)) {
      normalized.messages = conversation.messages.map(msg => this.normalizeMessage(msg));
    }

    normalized.dataVersion = this.version;

    return normalized;
  }

  /**
   * 检查数据是否需要迁移
   */
  needsMigration(data) {
    if (data.timestamp) return true;
    if (!data.createdAt || !data.updatedAt) return true;
    if (data.dataVersion !== this.version) return true;
    
    return false;
  }

  /**
   * 迁移旧数据到新格式
   */
  migrateData(data) {
    if (!this.needsMigration(data)) {
      return data;
    }

    console.log('Keep AI Memory: 开始数据迁移', {
      hasTimestamp: !!data.timestamp,
      hasCreatedAt: !!data.createdAt,
      hasUpdatedAt: !!data.updatedAt,
      version: data.dataVersion
    });

    // 如果是对话对象
    if (data.messages && Array.isArray(data.messages)) {
      return this.normalizeConversation(data);
    }
    
    // 如果是消息对象
    return this.normalizeMessage(data);
  }

  /**
   * 批量迁移数据
   */
  migrateBatch(dataArray) {
    if (!Array.isArray(dataArray)) {
      return dataArray;
    }

    return dataArray.map(item => this.migrateData(item));
  }

  /**
   * 获取数据统计信息
   */
  getDataStats(dataArray) {
    if (!Array.isArray(dataArray)) {
      return { total: 0, needsMigration: 0, valid: 0 };
    }

    const stats = {
      total: dataArray.length,
      needsMigration: 0,
      valid: 0,
      hasTimestamp: 0,
      missingCreatedAt: 0,
      missingUpdatedAt: 0
    };

    dataArray.forEach(item => {
      if (this.needsMigration(item)) {
        stats.needsMigration++;
      } else {
        stats.valid++;
      }

      if (item.timestamp) stats.hasTimestamp++;
      if (!item.createdAt) stats.missingCreatedAt++;
      if (!item.updatedAt) stats.missingUpdatedAt++;
    });

    return stats;
  }

  /**
   * 验证数据格式是否正确
   */
  validateData(data) {
    const result = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!data.createdAt) {
      result.isValid = false;
      result.errors.push('缺少createdAt字段');
    }

    if (!data.updatedAt) {
      result.isValid = false;
      result.errors.push('缺少updatedAt字段');
    }

    if (data.createdAt && !TimeUtils.isValidTimeString(data.createdAt)) {
      result.isValid = false;
      result.errors.push('createdAt格式不正确');
    }

    if (data.updatedAt && !TimeUtils.isValidTimeString(data.updatedAt)) {
      result.isValid = false;
      result.errors.push('updatedAt格式不正确');
    }

    if (data.timestamp) {
      result.warnings.push('发现旧的timestamp字段，建议迁移');
    }

    return result;
  }
}

// ==================== 统一兼容性处理器 ====================

/**
 * 统一兼容性处理器 - 整合时间处理、数据迁移和消息变化检测
 */
class Compatibility {
  constructor() {
    this.version = 2;
    
    // 数据迁移适配器
    this.migrationAdapter = new DataMigrationAdapter();
    
    // 缓存系统
    this.messageCache = new Map();
    this.hashCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000;
    
    // 变化追踪
    this.changeHistory = [];
    this.maxHistorySize = 100;
    
    // 批量操作
    this.batchQueue = [];
    this.batchTimeout = null;
    this.batchDelay = 100;
  }

  // ==================== 时间处理 ====================

  getMessageTime(message) {
    return TimeUtils.getMessageTime(message);
  }

  getConversationTime(conversation) {
    return TimeUtils.getConversationTime(conversation);
  }

  getLastMessageTime(conversation) {
    return TimeUtils.getLastMessageTime(conversation);
  }

  isValidTimeString(timeString) {
    return TimeUtils.isValidTimeString(timeString);
  }

  normalizeTimeString(timeString) {
    return TimeUtils.normalizeTimeString(timeString);
  }

  // ==================== 数据迁移 ====================

  normalizeMessage(message) {
    return this.migrationAdapter.normalizeMessage(message);
  }

  normalizeConversation(conversation) {
    return this.migrationAdapter.normalizeConversation(conversation);
  }

  needsMigration(data) {
    return this.migrationAdapter.needsMigration(data);
  }

  migrateData(data) {
    return this.migrationAdapter.migrateData(data);
  }

  migrateBatch(dataArray) {
    return this.migrationAdapter.migrateBatch(dataArray);
  }

  getDataStats(dataArray) {
    return this.migrationAdapter.getDataStats(dataArray);
  }

  validateData(data) {
    return this.migrationAdapter.validateData(data);
  }

  // ==================== 消息变化检测 ====================

  processMessageChanges(currentMessages, storedMessages) {
    console.log('Keep AI Memory: 开始处理消息变化', {
      currentCount: currentMessages.length,
      storedCount: storedMessages.length
    });

    const changes = {
      newMessages: [],
      updatedMessages: [],
      removedMessages: [],
      unchanged: []
    };

    const analysis = this.analyzeChanges(currentMessages, storedMessages);
    this.applyChanges(analysis, changes);
    this.recordChanges(changes);
    
    console.log('Keep AI Memory: 消息变化分析完成', {
      new: changes.newMessages.length,
      updated: changes.updatedMessages.length,
      removed: changes.removedMessages.length,
      unchanged: changes.unchanged.length
    });
    
    return changes;
  }

  analyzeChanges(currentMessages, storedMessages) {
    const analysis = {
      additions: [],
      modifications: [],
      deletions: [],
      unchanged: []
    };

    const currentMap = new Map(
      currentMessages.map(msg => [msg.messageId, msg])
    );
    const storedMap = new Map(
      storedMessages.map(msg => [msg.messageId, msg])
    );

    // 检测新增消息
    for (const [messageId, message] of currentMap) {
      if (!storedMap.has(messageId)) {
        analysis.additions.push(message);
      }
    }

    // 检测删除消息
    for (const [messageId, message] of storedMap) {
      if (!currentMap.has(messageId)) {
        analysis.deletions.push(message);
      }
    }

    // 检测修改消息
    for (const [messageId, currentMsg] of currentMap) {
      const storedMsg = storedMap.get(messageId);
      if (storedMsg && this.hasContentChanges(currentMsg, storedMsg)) {
        analysis.modifications.push({
          old: storedMsg,
          new: currentMsg
        });
      } else if (storedMsg) {
        analysis.unchanged.push(currentMsg);
      }
    }

    return analysis;
  }

  hasContentChanges(currentMsg, storedMsg) {
    // 只检查真正的内容字段变化
    if (currentMsg.content !== storedMsg.content) {
      return true;
    }

    // 检查thinking变化
    if (currentMsg.thinking !== storedMsg.thinking) {
      return true;
    }

    // 移除position/messageId检查：
    // - position和messageId本质相同（msgId包含position）
    // - 在锚点匹配成功时，这些字段被修正过，变化是正常的
    // - 在锚点匹配失败时，这些字段不可信
    // 移除sender检查：如果已经通过messageId匹配，sender应该一致

    return false;
  }

  applyChanges(analysis, changes) {
    changes.newMessages = analysis.additions;
    changes.updatedMessages = analysis.modifications.map(mod => mod.new);
    changes.removedMessages = analysis.deletions;
    changes.unchanged = analysis.unchanged;
  }

  recordChanges(changes, conversationId) {
    const changeRecord = {
      timestamp: new Date().toISOString(),
      conversationId,
      changes: {
        new: changes.newMessages.length,
        updated: changes.updatedMessages.length,
        removed: changes.removedMessages.length
      }
    };

    this.changeHistory.push(changeRecord);

    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory.shift();
    }
  }

  // ==================== 缓存管理 ====================

  getCachedMessage(key) {
    const cached = this.messageCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.messageCache.delete(key);
      return null;
    }

    return cached.data;
  }

  setCachedMessage(key, data) {
    this.messageCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  generateContentHash(content) {
    if (this.hashCache.has(content)) {
      return this.hashCache.get(content);
    }

    const hash = DataUtils.hashContent(content);
    this.hashCache.set(content, hash);
    return hash;
  }

  // ==================== 批量操作 ====================

  async batchUpdate(updates) {
    return new Promise((resolve, reject) => {
      this.batchQueue.push(...updates);

      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }

      this.batchTimeout = setTimeout(async () => {
        try {
          const currentBatch = [...this.batchQueue];
          this.batchQueue = [];

          const results = await this.executeBatchUpdate(currentBatch);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      }, this.batchDelay);
    });
  }

  async executeBatchUpdate(updates) {
    console.log('Keep AI Memory: 执行批量更新', updates.length);
    return updates;
  }

  // ==================== 工具方法 ====================

  clearCache() {
    this.messageCache.clear();
    this.hashCache.clear();
  }

  clearHistory() {
    this.changeHistory = [];
  }

  getCacheStats() {
    return {
      messageCacheSize: this.messageCache.size,
      hashCacheSize: this.hashCache.size,
      changeHistorySize: this.changeHistory.length
    };
  }

  getChangeHistory() {
    return [...this.changeHistory];
  }
}

// ==================== 导出 ====================

// 浏览器环境导出
if (typeof window !== 'undefined') {
  window.TimeUtils = TimeUtils;
  window.DataUtils = DataUtils;
  window.DataMigrationAdapter = DataMigrationAdapter;
  window.Compatibility = Compatibility;
}

// Node.js环境导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    // 函数式工具
    TimeUtils,
    DataUtils,
    
    // 数据迁移适配器
    DataMigrationAdapter,
    
    // 统一兼容性处理器
    Compatibility
  };
} 