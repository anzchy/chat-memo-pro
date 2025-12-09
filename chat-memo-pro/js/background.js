/**
 * Chat Memo 后台脚本
 * 作为扩展的核心部分，负责数据库操作和消息处理
 */

// 时间处理工具函数（与 compatibility.js 中的 TimeUtils.getMessageTime 保持一致）
function getMessageTime(message) {
  if (!message) return '';
  
  if (message.createdAt) return message.createdAt;
  if (message.timestamp) return message.timestamp;
  
  return new Date().toISOString();
}

// 初始化设置
const defaultSettings = {
  autoSave: true // 默认开启自动保存
};

// 平台名称映射（全局统一管理）
const PLATFORM_NAMES = {
  'chatgpt': 'ChatGPT',
  'deepseek': 'DeepSeek',
  'gemini': 'Gemini',
  'claude': 'Claude',
  'yuanbao': '腾讯元宝',
  'doubao': '豆包',
  'kimi': 'Kimi',
  'manus': 'Manus',
  'genspark': 'Genspark'
};

// 扩展安装或更新时
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 首次安装时初始化设置
    chrome.storage.sync.set({ settings: defaultSettings }, () => {
      console.log('Chat-Memo: ' + (chrome.i18n.getMessage('initSettingsComplete') || '初始化设置完成'));
    });
    
    // 首次安装时打开欢迎页面
    chrome.tabs.create({
      url: 'https://chatmemo.ai/welcome'
    });
  } else if (details.reason === 'update') {
    const currentVersion = chrome.runtime.getManifest().version;
    const previousVersion = details.previousVersion;
    
    console.log(`Chat-Memo: 插件已从版本 ${previousVersion} 更新到版本 ${currentVersion}`);
    
    // 检查是否为主要版本或次要版本更新
    if (isMajorVersionUpdate(previousVersion, currentVersion) || 
        isMinorVersionUpdate(previousVersion, currentVersion)) {
      chrome.tabs.create({
        url: 'https://chatmemo.ai/updates'
      });
      console.log('Chat-Memo: 已打开更新提示页面');
    } else {
      console.log('Chat-Memo: 当前版本无需显示更新提示');
    }
  }
});

/**
 * 检查是否为主要版本更新（主版本号变化）
 * @param {string} oldVersion - 旧版本
 * @param {string} newVersion - 新版本
 * @returns {boolean}
 */
function isMajorVersionUpdate(oldVersion, newVersion) {
  if (!oldVersion || !newVersion) return false;
  
  const oldMajor = parseInt(oldVersion.split('.')[0]);
  const newMajor = parseInt(newVersion.split('.')[0]);
  
  return newMajor > oldMajor;
}

/**
 * 检查是否为次要版本更新（次版本号变化）
 * @param {string} oldVersion - 旧版本
 * @param {string} newVersion - 新版本
 * @returns {boolean}
 */
function isMinorVersionUpdate(oldVersion, newVersion) {
  if (!oldVersion || !newVersion) return false;
  
  const oldParts = oldVersion.split('.');
  const newParts = newVersion.split('.');
  
  const oldMajor = parseInt(oldParts[0]);
  const newMajor = parseInt(newParts[0]);
  const oldMinor = parseInt(oldParts[1]);
  const newMinor = parseInt(newParts[1]);
  
  // 主版本号相同，但次版本号增加
  return oldMajor === newMajor && newMinor > oldMinor;
}

// 监听来自内容脚本和弹出窗口的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 根据消息类型分发处理
  switch (message.type) {
    case 'connectDB':
      // 数据库连接请求（实际上IndexedDB在content script中初始化）
      sendResponse({ status: 'ok' });
      break;
      
    case 'findConversationByUrl':
      findConversationByUrl(message.url)
        .then(conversation => {
          sendResponse({ conversation });
        })
        .catch(error => {
          console.error(chrome.i18n.getMessage('queryConversationFailed') || '查询会话失败:', error);
          sendResponse({ error: error.toString() });
        });
      return true; // 保持消息通道开放，等待异步响应
      
    case 'createConversation':
      createConversation(message.conversation)
        .then(conversationId => {
          sendResponse({ conversationId });
          // 通知侧边栏刷新
          notifySidebarRefresh();
        })
        .catch(error => {
          console.error(chrome.i18n.getMessage('createConversationFailed') || '创建会话失败:', error);
          sendResponse({ error: error.toString() });
        });
      return true;
      
    case 'updateConversation':
      updateConversation(message.conversation)
        .then(() => {
          sendResponse({ status: 'ok' });
          // 通知侧边栏刷新
          notifySidebarRefresh();
        })
        .catch(error => {
          console.error(chrome.i18n.getMessage('updateConversationFailed') || '更新会话失败:', error);
          sendResponse({ error: error.toString() });
        });
      return true;
      
    case 'getConversationById':
      getConversationById(message.conversationId)
        .then(conversation => {
          sendResponse({ conversation });
        })
        .catch(error => {
          console.error(chrome.i18n.getMessage('getConversationFailed') || '获取会话失败:', error);
          sendResponse({ error: error.toString() });
        });
      return true;
      
    case 'getAllConversations':
      getAllConversations()
        .then(conversations => {
          sendResponse({ conversations });
        })
        .catch(error => {
          console.error(chrome.i18n.getMessage('getAllConversationsFailed') || '获取所有会话失败:', error);
          sendResponse({ error: error.toString() });
        });
      return true;
      
    case 'deleteConversation':
      deleteConversation(message.conversationId)
        .then(() => {
          sendResponse({ status: 'ok' });
          // 通知侧边栏刷新
          notifySidebarRefresh();
        })
        .catch(error => {
          console.error(chrome.i18n.getMessage('deleteConversationFailed') || '删除会话失败:', error);
          sendResponse({ error: error.toString() });
        });
      return true;
      
    case 'getStorageUsage':
      getStorageUsage()
        .then(usage => {
          sendResponse({ usage });
        })
        .catch(error => {
          console.error(chrome.i18n.getMessage('getStorageUsageFailed') || '获取存储使用情况失败:', error);
          sendResponse({ error: error.toString() });
        });
      return true;
      
    case 'updateSettings':
      updateSettings(message.settings)
        .then(() => {
          // 通知所有内容脚本设置已更新
          notifySettingsUpdated(message.settings);
          sendResponse({ status: 'ok' });
        })
        .catch(error => {
          console.error(chrome.i18n.getMessage('updateSettingsFailed') || '更新设置失败:', error);
          sendResponse({ error: error.toString() });
        });
      return true;
      
    case 'getSettings':
      getSettings()
        .then(settings => {
          sendResponse({ settings });
        })
        .catch(error => {
          console.error(chrome.i18n.getMessage('getSettingsFailed') || '获取设置失败:', error);
          sendResponse({ error: error.toString() });
        });
      return true;
      

    case 'exportConversationsByRange':
      exportConversationsByRange(message.conversationIds, message.exportType, message.metadata)
        .then(url => {
          sendResponse({ url });
        })
        .catch(error => {
          console.error(chrome.i18n.getMessage('exportConversationsFailed') || '导出会话失败:', error);
          sendResponse({ error: error.toString() });
        });
      return true;
      

    case 'clearStorage':
      clearAllConversations()
        .then(() => {
          sendResponse({ status: 'ok' });
        })
        .catch(error => {
          console.error(chrome.i18n.getMessage('clearStorageFailed') || '清除存储失败:', error);
          sendResponse({ error: error.toString() });
        });
      return true;
      
    case 'openSidePanel':
      // 处理来自内容脚本的侧边栏打开请求
      // 现在使用注入式侧边栏方案，直接通知 content script
      if (sender.tab && sender.tab.id) {
        // 发送消息给 content script 打开注入式侧边栏
        chrome.tabs.sendMessage(sender.tab.id, { type: 'toggleSidebar' })
          .then(() => {
            sendResponse({ status: 'ok' });
          })
          .catch(error => {
            console.error('发送打开侧边栏消息失败:', error);
            sendResponse({ error: error.toString() });
          });
      } else {
        sendResponse({ error: chrome.i18n.getMessage('cannotGetCurrentTabInfo') || '无法获取当前标签页信息' });
      }
      return true;
  }
  
  return false;
});

/**
 * 带重试的发送侧边栏切换消息
 * @param {number} tabId - 标签页ID
 * @param {number} retries - 剩余重试次数
 */
async function sendToggleSidebarWithRetry(tabId, retries = 3) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'toggleSidebar' });
    console.log('Chat-Memo: 侧边栏切换消息发送成功');
  } catch (error) {
    if (retries > 0) {
      console.log(`Chat-Memo: 消息发送失败，${200}ms 后重试 (剩余 ${retries} 次)...`);
      await new Promise(resolve => setTimeout(resolve, 200));
      return sendToggleSidebarWithRetry(tabId, retries - 1);
    } else {
      console.error('Chat-Memo: 发送打开侧边栏消息失败:', error.message);
      console.log('Chat-Memo: content script 可能未加载，请刷新页面后重试');
    }
  }
}

// 监听扩展图标点击事件，发送消息给 content script 打开注入式侧边栏
chrome.action.onClicked.addListener((tab) => {
  // 检查是否在支持的页面（有 content script 的页面）
  const url = tab.url || '';

  // 如果是特殊页面（chrome://, edge:// 等），不支持 content script
  if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:') || url.startsWith('file://')) {
    console.log('Chat-Memo: 当前页面不支持使用侧边栏，请在支持的 AI 聊天平台页面使用');
    return;
  }

  // 使用带重试的发送函数
  sendToggleSidebarWithRetry(tab.id);
});

// 数据库对象和相关函数
const DB_NAME = 'KeepAIMemoryDB';
const DB_VERSION = 1;
const CONVERSATION_STORE = 'conversations';

// 打开数据库连接
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(CONVERSATION_STORE)) {
        const conversationStore = db.createObjectStore(CONVERSATION_STORE, { keyPath: 'conversationId' });
        conversationStore.createIndex('link', 'link', { unique: false });
        conversationStore.createIndex('platform', 'platform', { unique: false });
        conversationStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        conversationStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 根据URL查找会话
async function findConversationByUrl(url) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATION_STORE], 'readonly');
    const store = transaction.objectStore(CONVERSATION_STORE);
    const index = store.index('link');
    const request = index.get(url);
    
    request.onsuccess = () => {
      resolve(request.result || null);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 创建新会话
async function createConversation(conversation) {
  const db = await openDB();
  
  // 生成唯一ID
  conversation.conversationId = conversation.conversationId || generateId();
  
  // 设置时间戳
  const now = new Date().toISOString();
  conversation.createdAt = conversation.createdAt || now;
  conversation.updatedAt = now;
  
  // 初始化消息数组
  if (!conversation.messages) {
    conversation.messages = [];
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATION_STORE], 'readwrite');
    const store = transaction.objectStore(CONVERSATION_STORE);
    const request = store.add(conversation);
    
    request.onsuccess = () => {
      resolve(conversation.conversationId);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 更新会话
async function updateConversation(conversation) {
  const db = await openDB();
  
  // 更新时间戳
  conversation.updatedAt = new Date().toISOString();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATION_STORE], 'readwrite');
    const store = transaction.objectStore(CONVERSATION_STORE);
    const request = store.put(conversation);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 获取会话
async function getConversationById(conversationId) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATION_STORE], 'readonly');
    const store = transaction.objectStore(CONVERSATION_STORE);
    const request = store.get(conversationId);
    
    request.onsuccess = () => {
      resolve(request.result || null);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 获取对话的排序时间（与显示逻辑保持一致）
function getConversationSortTime(conversation) {
  if (!conversation) return new Date().toISOString();
  
  // 优先使用最后一条消息的时间
  if (conversation.messages && conversation.messages.length > 0) {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage.updatedAt) return lastMessage.updatedAt;
    if (lastMessage.createdAt) return lastMessage.createdAt;
    if (lastMessage.timestamp) return lastMessage.timestamp;
  }
  
  // 如果没有消息，使用对话本身的时间
  if (conversation.lastMessageAt) return conversation.lastMessageAt;
  if (conversation.createdAt) return conversation.createdAt;
  if (conversation.timestamp) return conversation.timestamp;
  
  // 最后降级处理
  return new Date().toISOString();
}

// 获取所有会话
async function getAllConversations() {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATION_STORE], 'readonly');
    const store = transaction.objectStore(CONVERSATION_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => {
      // 按最后消息时间倒序排序（与显示逻辑保持一致）
      const conversations = request.result || [];
      conversations.sort((a, b) => {
        return new Date(getConversationSortTime(b)) - new Date(getConversationSortTime(a));
      });
      resolve(conversations);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 删除会话
async function deleteConversation(conversationId) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATION_STORE], 'readwrite');
    const store = transaction.objectStore(CONVERSATION_STORE);
    const request = store.delete(conversationId);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 获取存储使用情况
async function getStorageUsage() {
  const db = await openDB();
  
  return new Promise((resolve) => {
    const transaction = db.transaction([CONVERSATION_STORE], 'readonly');
    const store = transaction.objectStore(CONVERSATION_STORE);
    const countRequest = store.count();
    
    countRequest.onsuccess = () => {
      const totalConversations = countRequest.result;
      
      // 获取今日新增会话
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISOString = today.toISOString();
      
      const index = store.index('createdAt');
      const range = IDBKeyRange.lowerBound(todayISOString);
      const todayRequest = index.count(range);
      
      todayRequest.onsuccess = () => {
        const todayCount = todayRequest.result;
        
        resolve({
          totalConversations,
          todayNewConversations: todayCount
        });
      };
    };
  });
}

// 更新设置
async function updateSettings(settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ settings }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// 获取设置
async function getSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['settings'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.settings || defaultSettings);
      }
    });
  });
}

// 通知所有内容脚本设置已更新
function notifySettingsUpdated(settings) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      // 过滤出支持的AI Chat页面
      if (tab.url && (
        tab.url.includes('chat.deepseek.com') ||
        tab.url.includes('chatgpt.com') ||
        tab.url.includes('chat.openai.com') ||
        tab.url.includes('gemini.google.com') ||
        tab.url.includes('yuanbao.tencent.com') ||
        tab.url.includes('doubao.com') ||
        tab.url.includes('claude.ai') ||
        tab.url.includes('kimi.moonshot.cn') ||
        tab.url.includes('kimi.com')
      )) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'settingsUpdated',
          settings
        }).catch(() => {
          // 忽略无法发送消息的错误
          // 这可能是因为内容脚本尚未加载
        });
      }
    });
  });
}

// 加载JSZip库
try {
  importScripts('../lib/jszip.min.js');
  console.log('JSZip库加载成功');
} catch (error) {
  console.error('JSZip库加载失败:', error);
}

/**
 * 统一的导出函数 - 按指定范围导出对话
 * @param {Array} conversationIds - 要导出的对话ID列表
 * @param {string} exportType - 导出类型 ('separate' | 'merged')  
 * @param {Object} metadata - 元数据（标题、筛选条件等）
 */
async function exportConversationsByRange(conversationIds, exportType = 'separate', metadata = {}) {
  // 根据ID列表获取对话
  const conversations = [];
  
  for (const id of conversationIds) {
    try {
      const conversation = await getConversationById(id);
      if (conversation) {
        conversations.push(conversation);
      }
    } catch (error) {
      console.error('获取对话失败:', id, error);
    }
  }
  
  if (conversations.length === 0) {
    return null;
  }
  
  // 按创建时间倒序排列（最新的在前面）
  const sortedConversations = conversations.sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return dateB - dateA;
  });
  
  if (exportType === 'merged') {
    return exportAsMergedFile(sortedConversations, metadata);
  } else {
    return exportAsSeparateFiles(sortedConversations, metadata);
  }
}

/**
 * 导出为单个合并文件
 */
async function exportAsMergedFile(conversations, metadata) {
  return new Promise((resolve) => {
    try {
      // 生成合并内容
      let mergedContent = generateMergedExportContent(conversations, metadata);
      
      // 生成统一格式文件名
      const count = conversations.length;
      const filename = generateStandardExportFilename(count, 'txt');
      
      // 创建Blob并使用Downloads API下载
      const blob = new Blob([mergedContent], { type: 'text/plain;charset=utf-8' });
      
      // 使用FileReader创建Data URL
      const reader = new FileReader();
      reader.onload = function() {
        const dataUrl = reader.result;
        
        // 使用chrome.downloads API下载文件
        chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error('下载失败:', chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(dataUrl);
          }
        });
      };
      reader.onerror = function() {
        console.error('读取文件失败:', reader.error);
        resolve(null);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('导出合并文件失败:', error);
      resolve(null);
    }
  });
}

/**
 * 导出为多个独立文件（ZIP格式）
 */
async function exportAsSeparateFiles(conversations, metadata) {
  return new Promise((resolve) => {
    try {
      // 创建新的JSZip实例
      const zip = new JSZip();
      
      // 为每个会话创建文本文件
      conversations.forEach(conversation => {
        const content = formatConversationForExport(conversation);
        const filename = generateExportFilename(conversation);
        
        zip.file(filename, content, {
          binary: false,
          date: new Date()
        });
      });
      
      // 生成统一格式ZIP文件名
      const count = conversations.length;
      const zipFilename = generateStandardExportFilename(count, 'zip');
      
      zip.generateAsync({ 
        type: 'blob', 
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6
        }
      }).then(blob => {
        // 使用FileReader创建Data URL，与原有方式保持一致
        const reader = new FileReader();
        reader.onload = function() {
          const dataUrl = reader.result;
          
          // 使用chrome.downloads API下载文件
          chrome.downloads.download({
            url: dataUrl,
            filename: zipFilename,
            saveAs: true
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error('ZIP下载失败:', chrome.runtime.lastError);
              resolve(null);
            } else {
              resolve(dataUrl);
            }
          });
        };
        reader.onerror = function() {
          console.error('读取ZIP文件失败:', reader.error);
          resolve(null);
        };
        reader.readAsDataURL(blob);
      }).catch(error => {
        console.error('生成ZIP文件失败:', error);
        resolve(null);
      });
    } catch (error) {
      console.error('导出独立文件失败:', error);
      resolve(null);
    }
  });
}

/**
 * 生成合并导出内容（纯文本格式）
 */
function generateMergedExportContent(conversations, metadata) {
  let content = `# Chat Memo - All Conversations\n`;
  content += `Export Time: ${formatDateTimeForDisplay(new Date())}\n`;
  content += `Total Conversations: ${conversations.length}\n`;
  
  // 添加筛选条件信息
  if (metadata.searchTerm || metadata.filter) {
    content += `\nFilter Conditions:\n`;
    if (metadata.searchTerm) {
      content += `- Search Term: ${metadata.searchTerm}\n`;
    }
    if (metadata.filter) {
      if (metadata.filter.startDate) {
        content += `- Start Date: ${metadata.filter.startDate}\n`;
      }
      if (metadata.filter.endDate) {
        content += `- End Date: ${metadata.filter.endDate}\n`;
      }
      if (metadata.filter.platforms && metadata.filter.platforms.length > 0) {
        const selectedPlatforms = metadata.filter.platforms.map(p => PLATFORM_NAMES[p] || p).join(', ');
        content += `- Selected Platforms: ${selectedPlatforms}\n`;
      }
    }
  }
  
  content += '\n' + '='.repeat(80) + '\n\n';
  
  // 按时间排序对话（最新的在前）
  const sortedConversations = conversations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // 添加每个对话，使用现有的formatConversationForExport函数保持格式一致
  sortedConversations.forEach((conversation, index) => {
    content += formatConversationForExport(conversation);
    if (index < sortedConversations.length - 1) {
      content += '\n' + '='.repeat(80) + '\n\n';
    }
  });
  
  return content;
}

/**
 * 获取平台的显示名称
 */
function getPlatformDisplayName(platform) {
  return PLATFORM_NAMES[platform] || platform;
}

/**
 * 生成统一的导出文件名
 * @param {number} count - 对话数量
 * @param {string} fileType - 文件类型 ('zip' | 'md')
 * @returns {string} 统一格式文件名
 */
function generateStandardExportFilename(count, fileType) {
  const timestamp = formatDateForFilename(new Date());
  return `chat-memo_${count}_${timestamp}.${fileType}`;
}





// 格式化会话内容用于导出
function formatConversationForExport(conversation) {
  // 构建标题部分
  let output = `Title: ${conversation.title || 'Untitled Conversation'}\n`;
  output += `URL: ${conversation.link}\n`;
  output += `Platform: ${getPlatformDisplayName(conversation.platform)}\n`;
  
  // 格式化创建时间为 yyyy-MM-DD hh:mm:ss
  const createdAtFormatted = formatDateTimeForDisplay(new Date(conversation.createdAt));
  output += `Created: ${createdAtFormatted}\n`;
  output += `Messages: ${conversation.messages.length}\n\n`;
  
  // 添加每条消息
  conversation.messages.forEach(message => {
    const sender = message.sender === 'user' ? 'User' : 'AI';
    
    // 格式化消息时间为 yyyy-MM-DD hh:mm:ss
    let timestamp = getMessageTime(message);
    if (timestamp) {
      try {
        timestamp = formatDateTimeForDisplay(new Date(timestamp));
      } catch (e) {
        // 如果无法解析时间戳，保持原样
      }
    }
    
    output += `${sender}: [${timestamp}]\n`;
    
    // 如果是AI消息且有thinking内容
    if (sender === 'AI' && message.thinking) {
      output += '<thinking>\n';
      output += `${message.thinking}\n`;
      output += '</thinking>\n';
    }
    
    output += `${message.content}\n\n`;
  });
  
  return output;
}

// 生成导出文件名
function generateExportFilename(conversation) {
  // 获取平台名称
  const platform = conversation.platform || 'Unknown';
  
  // 格式化创建时间，精确到秒 (yyyyMMddHHmmss)
  let timestamp;
  try {
    const createdDate = new Date(conversation.createdAt);
    timestamp = formatDateForFilename(createdDate);
  } catch (e) {
    // 如果日期解析失败，使用当前时间
    const now = new Date();
    timestamp = formatDateForFilename(now);
  }
  
  // 使用新的清理函数处理标题
  const title = conversation.title ? 
    cleanFilename(conversation.title, 30) : 
    chrome.i18n.getMessage('conversation') || 'conversation';
  
  return `${platform}_${timestamp}_${title}.txt`;
}

// 生成唯一ID
function generateId() {
  return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * 格式化日期时间为 yyyy-MM-DD hh:mm:ss 格式
 * @param {Date} date - 日期对象
 * @returns {string} - 格式化后的日期时间字符串
 */
function formatDateTimeForDisplay(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    return 'Invalid Date';
  }
  
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  const hours = ('0' + date.getHours()).slice(-2);
  const minutes = ('0' + date.getMinutes()).slice(-2);
  const seconds = ('0' + date.getSeconds()).slice(-2);
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化日期时间为 yyyyMMDDhhmmss 格式，用于文件名
 * @param {Date} date - 日期对象
 * @returns {string} - 格式化后的日期时间字符串
 */
function formatDateForFilename(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    return 'InvalidDate';
  }
  
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  const hours = ('0' + date.getHours()).slice(-2);
  const minutes = ('0' + date.getMinutes()).slice(-2);
  const seconds = ('0' + date.getSeconds()).slice(-2);
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * 清理文件名字符串，处理空格、下划线等特殊字符
 * @param {string} filename - 原始文件名
 * @param {number} maxLength - 最大长度，默认30
 * @returns {string} - 清理后的文件名
 */
function cleanFilename(filename, maxLength = 30) {
  if (!filename || typeof filename !== 'string') {
    return 'untitled';
  }
  
  // 截取指定长度
  let cleaned = filename.substring(0, maxLength);
  
  // 保留中文、日文、韩文、英文、数字，将其他字符替换为下划线
  cleaned = cleaned.replace(/[^\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/gi, '_');
  
  // 将空格替换为下划线
  cleaned = cleaned.replace(/\s+/g, '_');
  
  // 合并连续的下划线为单个下划线
  cleaned = cleaned.replace(/_+/g, '_');
  
  // 移除开头和结尾的下划线
  cleaned = cleaned.replace(/^_+|_+$/g, '');
  
  // 如果清理后为空，使用默认名称
  if (!cleaned) {
    return 'untitled';
  }
  
  return cleaned;
}

// 清除所有会话
async function clearAllConversations() {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATION_STORE], 'readwrite');
    const store = transaction.objectStore(CONVERSATION_STORE);
    const request = store.clear();
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 通知侧边栏刷新
function notifySidebarRefresh() {
  // 使用storage change事件来通知刷新
  // 这是一个简单的触发机制
  chrome.storage.local.set({
    'sidebar_refresh_trigger': Date.now()
  });
}


