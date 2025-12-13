# Chrome Extension 最佳实践技术方案

> 基于 Chat Memo Pro 和 Insidebar AI 的技术栈总结
> 适用于 Manifest V3 的现代 Chrome 扩展开发

## 📋 目录

- [核心架构](#核心架构)
- [Manifest V3 配置](#manifest-v3-配置)
- [侧边栏实现](#侧边栏实现)
- [消息传递](#消息传递)
- [数据存储](#数据存储)
- [Content Scripts 组织](#content-scripts-组织)
- [国际化 (i18n)](#国际化-i18n)
- [性能优化](#性能优化)
- [调试与测试](#调试与测试)
- [常见陷阱](#常见陷阱)

---

## 核心架构

### 三层架构模式

```
┌─────────────────────────────────────────┐
│         Background Service Worker       │  ← 核心控制中心
│  - 状态管理                              │
│  - 消息路由                              │
│  - 数据库操作                            │
│  - API调用                               │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌──────▼──────────┐
│ Content Scripts│  │  Side Panel/    │
│  - DOM 操作    │  │  Popup UI       │
│  - 页面监听    │  │  - 用户界面     │
│  - 数据提取    │  │  - 数据展示     │
└────────────────┘  └─────────────────┘
```

### 关键设计原则

1. **职责分离**
   - Background: 业务逻辑、数据管理
   - Content Scripts: 页面交互、DOM操作
   - UI (Side Panel/Popup): 纯展示层

2. **单向数据流**
   ```
   User Action → UI → Message → Background → Storage
                                      ↓
   Storage Change → Background → Message → UI Update
   ```

3. **状态管理**
   - 使用 Map/Object 集中管理状态
   - 避免跨组件直接共享状态
   - 通过消息传递同步状态

---

## Manifest V3 配置

### 基础配置模板

```json
{
  "manifest_version": 3,
  "name": "Your Extension Name",
  "version": "1.0.0",
  "description": "Extension Description",
  "default_locale": "en",

  "permissions": [
    "sidePanel",      // 侧边栏API
    "storage",        // 数据存储
    "tabs",          // 标签页操作
    "downloads"      // 文件下载
  ],

  "host_permissions": [
    "https://example.com/*"
  ],

  "background": {
    "service_worker": "js/background.js",
    "type": "module"  // 推荐使用 ES6 模块
  },

  "side_panel": {
    "default_path": "html/sidebar.html"
  },

  "action": {
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "content_scripts": [
    {
      "matches": ["https://example.com/*"],
      "js": ["js/content.js"],
      "run_at": "document_end",
      "all_frames": false
    }
  ],

  "web_accessible_resources": [
    {
      "resources": ["icons/*", "css/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 关键权限说明

| 权限 | 用途 | 注意事项 |
|------|------|----------|
| `sidePanel` | 使用侧边栏 API | Manifest V3 必需 |
| `storage` | 数据持久化 | 推荐使用 `chrome.storage.local` |
| `tabs` | 操作标签页 | 需要时才申请 |
| `downloads` | 下载文件 | 导出功能必需 |
| `clipboardRead` | 读取剪贴板 | 需要用户授权 |
| `declarativeNetRequest` | 修改网络请求 | 高级功能 |

---

## 侧边栏实现

### ✅ 推荐方案：Chrome Side Panel API

**为什么使用 Side Panel API？**
- ✅ 原生支持，100% 可靠
- ✅ 不依赖 content script
- ✅ 更好的性能和用户体验
- ✅ 与浏览器 UI 无缝集成

### 实现步骤

#### 1. Manifest 配置

```json
{
  "permissions": ["sidePanel"],
  "side_panel": {
    "default_path": "html/sidebar.html"
  }
}
```

#### 2. Background 状态管理

```javascript
// 跟踪每个窗口的侧边栏状态
const sidePanelState = new Map();

/**
 * 配置侧边栏行为
 */
async function configureActionBehavior() {
  try {
    // 禁用默认点击打开，使用自定义 toggle 逻辑
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: false
    });
    console.log('侧边栏行为配置完成');
  } catch (error) {
    console.error('配置失败:', error);
  }
}

/**
 * 切换侧边栏
 */
async function toggleSidePanel(windowId) {
  if (!windowId) return;

  const isOpen = sidePanelState.get(windowId) || false;

  if (!isOpen) {
    // 打开侧边栏
    try {
      await chrome.sidePanel.open({ windowId });
      sidePanelState.set(windowId, true);
      console.log('侧边栏已打开');
    } catch (error) {
      console.error('打开侧边栏失败:', error);
    }
  } else {
    // 关闭侧边栏
    try {
      await chrome.runtime.sendMessage({ type: 'closeSidePanel' });
      sidePanelState.set(windowId, false);
      console.log('侧边栏关闭请求已发送');
    } catch (error) {
      sidePanelState.set(windowId, false);
    }
  }
}

// 监听扩展图标点击
chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.windowId) {
    await toggleSidePanel(tab.windowId);
  }
});

// 清理窗口关闭时的状态
chrome.windows.onRemoved.addListener((windowId) => {
  sidePanelState.delete(windowId);
});

// 安装和启动时配置
chrome.runtime.onInstalled.addListener(configureActionBehavior);
chrome.runtime.onStartup.addListener(configureActionBehavior);
```

#### 3. Sidebar UI 关闭处理

```javascript
// sidebar.js
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-sidebar-btn');

  closeBtn?.addEventListener('click', () => {
    // 通知 background 更新状态
    chrome.runtime.sendMessage({ type: 'closeSidePanel' }, () => {
      window.close(); // 关闭侧边栏
    });
  });
});

// 监听来自 background 的关闭请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'closeSidePanel') {
    window.close();
    sendResponse({ success: true });
  }
});
```

#### 4. Background 消息处理

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'closeSidePanel') {
    // 获取当前窗口并更新状态
    chrome.windows.getCurrent((window) => {
      if (window?.id) {
        sidePanelState.set(window.id, false);
      }
      sendResponse({ status: 'ok' });
    });
    return true; // 保持消息通道开放
  }
});
```

### 侧边栏 UI 设计要点

```html
<!-- 推荐的侧边栏布局 -->
<body>
  <header class="sidebar-header">
    <!-- 关闭按钮放在右上角 -->
    <button id="close-sidebar-btn" class="close-btn">
      <i class="fas fa-times"></i>
    </button>
    <h1>Extension Title</h1>
  </header>

  <main class="sidebar-content">
    <!-- 主要内容区域 -->
  </main>

  <aside class="sidebar-nav">
    <!-- 导航栏 -->
  </aside>
</body>
```

---

## 消息传递

### 消息类型定义

```javascript
// 推荐：定义消息类型常量
const MessageTypes = {
  // Data operations
  GET_DATA: 'getData',
  UPDATE_DATA: 'updateData',
  DELETE_DATA: 'deleteData',

  // UI operations
  CLOSE_SIDE_PANEL: 'closeSidePanel',
  REFRESH_UI: 'refreshUI',

  // Content script operations
  EXTRACT_CONTENT: 'extractContent',
  INJECT_UI: 'injectUI'
};
```

### Background ↔ Popup/Sidebar

```javascript
// ✅ 推荐：统一的消息处理器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case MessageTypes.GET_DATA:
      handleGetData(payload)
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // 异步响应

    case MessageTypes.UPDATE_DATA:
      handleUpdateData(payload)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// 辅助函数：安全的消息发送
async function sendMessageSafely(message) {
  try {
    const response = await chrome.runtime.sendMessage(message);
    return response;
  } catch (error) {
    console.error('消息发送失败:', error);
    return { success: false, error: error.message };
  }
}
```

### Background ↔ Content Script

```javascript
// Background → Content Script
async function sendToContentScript(tabId, message) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response;
  } catch (error) {
    console.error('发送到 content script 失败:', error);
    throw error;
  }
}

// Content Script 接收
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MessageTypes.EXTRACT_CONTENT) {
    const content = extractPageContent();
    sendResponse({ success: true, content });
  }
  return true;
});
```

### 广播消息

```javascript
// 通知所有标签页刷新
async function notifyAllTabs(message) {
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      // 某些标签可能没有 content script，忽略错误
    }
  }
}

// 通知侧边栏刷新
function notifySidebarRefresh() {
  chrome.storage.local.set({
    sidebar_refresh_trigger: Date.now()
  });
}
```

---

## 数据存储

### 推荐方案对比

| 方案 | 适用场景 | 容量限制 | 同步 |
|------|----------|----------|------|
| `chrome.storage.sync` | 设置、配置 | 100KB | ✅ 跨设备 |
| `chrome.storage.local` | 对话数据 | 10MB | ❌ 本地 |
| `IndexedDB` | 大量数据 | 无限制* | ❌ 本地 |

*实际受磁盘空间限制

### Chrome Storage 最佳实践

```javascript
// 设置管理
class SettingsManager {
  static async get() {
    const result = await chrome.storage.sync.get('settings');
    return result.settings || this.getDefaults();
  }

  static async update(updates) {
    const current = await this.get();
    const newSettings = { ...current, ...updates };
    await chrome.storage.sync.set({ settings: newSettings });

    // 通知变更
    this.notifyChange(newSettings);
  }

  static getDefaults() {
    return {
      autoSave: true,
      language: 'en',
      theme: 'light'
    };
  }

  static notifyChange(settings) {
    chrome.runtime.sendMessage({
      type: 'settingsChanged',
      settings
    });
  }
}

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.settings) {
    const newSettings = changes.settings.newValue;
    console.log('设置已更新:', newSettings);
    // 更新 UI
    updateUI(newSettings);
  }
});
```

### IndexedDB 封装

```javascript
class ConversationDB {
  constructor() {
    this.dbName = 'ConversationsDB';
    this.version = 1;
    this.storeName = 'conversations';
  }

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id'
          });

          // 创建索引
          store.createIndex('platform', 'platform', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('title', 'title', { unique: false });
        }
      };
    });
  }

  async add(conversation) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add({
        ...conversation,
        id: conversation.id || `conv_${Date.now()}`,
        timestamp: conversation.timestamp || Date.now()
      });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getByPlatform(platform) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('platform');
      const request = index.getAll(platform);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// 使用示例
const db = new ConversationDB();

// 添加对话
await db.add({
  title: 'Chat with AI',
  platform: 'chatgpt',
  messages: [...]
});

// 获取所有对话
const conversations = await db.getAll();

// 按平台筛选
const chatgptConvs = await db.getByPlatform('chatgpt');
```

---

## Content Scripts 组织

### 适配器模式

```javascript
/**
 * 基础适配器类
 */
class BasePlatformAdapter {
  constructor(platformName) {
    this.platform = platformName;
    this.observer = null;
  }

  // 子类必须实现的方法
  isValidConversationUrl(url) {
    throw new Error('必须实现 isValidConversationUrl');
  }

  extractConversationInfo(url) {
    throw new Error('必须实现 extractConversationInfo');
  }

  isMessageElement(element) {
    throw new Error('必须实现 isMessageElement');
  }

  extractMessages() {
    throw new Error('必须实现 extractMessages');
  }

  extractTitle() {
    throw new Error('必须实现 extractTitle');
  }

  // 通用方法
  start() {
    console.log(`${this.platform} adapter started`);
    this.setupMutationObserver();
    this.checkForActualMessageChanges();
  }

  setupMutationObserver() {
    const config = {
      childList: true,
      subtree: true
    };

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(document.body, config);
    return this.observer;
  }

  handleMutations(mutations) {
    // 防抖处理
    if (this.mutationTimeout) {
      clearTimeout(this.mutationTimeout);
    }

    this.mutationTimeout = setTimeout(() => {
      this.checkForActualMessageChanges();
    }, 500);
  }

  async checkForActualMessageChanges() {
    const messages = this.extractMessages();

    if (messages.length > 0) {
      await this.saveConversation(messages);
    }
  }

  async saveConversation(messages) {
    const conversation = {
      platform: this.platform,
      title: this.extractTitle(),
      messages: messages,
      url: window.location.href,
      timestamp: Date.now()
    };

    // 发送到 background
    chrome.runtime.sendMessage({
      type: 'updateConversation',
      conversation
    });
  }
}

/**
 * ChatGPT 适配器示例
 */
class ChatGPTAdapter extends BasePlatformAdapter {
  constructor() {
    super('chatgpt');
  }

  isValidConversationUrl(url) {
    return /^https:\/\/(chat\.openai\.com|chatgpt\.com)\/c\//.test(url);
  }

  extractConversationInfo(url) {
    const match = url.match(/\/c\/([a-f0-9-]+)/);
    return {
      conversationId: match ? `chatgpt_${match[1]}` : null,
      isNewConversation: url.includes('/c/') === false
    };
  }

  isMessageElement(element) {
    return element.matches('[data-message-author-role]');
  }

  extractMessages() {
    const messages = [];
    const messageElements = document.querySelectorAll('[data-message-author-role]');

    messageElements.forEach(el => {
      const role = el.getAttribute('data-message-author-role');
      const content = el.querySelector('.markdown')?.innerText || '';

      if (content) {
        messages.push({
          sender: role === 'user' ? 'user' : 'AI',
          content: content.trim(),
          timestamp: Date.now()
        });
      }
    });

    return messages;
  }

  extractTitle() {
    // 尝试从页面标题提取
    const titleElement = document.querySelector('title');
    if (titleElement) {
      return titleElement.textContent.replace(' - ChatGPT', '').trim();
    }

    // 回退：使用第一条用户消息
    const messages = this.extractMessages();
    const firstUserMsg = messages.find(m => m.sender === 'user');
    if (firstUserMsg) {
      return firstUserMsg.content.substring(0, 60) + '...';
    }

    return 'ChatGPT Conversation';
  }
}

// 初始化
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const adapter = new ChatGPTAdapter();
    adapter.start();
    window.AdapterInstance = adapter; // 暴露到全局便于调试
  });
}
```

### 多平台管理

```javascript
// manifest.json
{
  "content_scripts": [
    {
      "matches": ["https://chatgpt.com/*", "https://chat.openai.com/*"],
      "js": [
        "js/core/base-adapter.js",
        "js/adapters/chatgpt.js"
      ]
    },
    {
      "matches": ["https://claude.ai/*"],
      "js": [
        "js/core/base-adapter.js",
        "js/adapters/claude.js"
      ]
    },
    {
      "matches": ["https://gemini.google.com/*"],
      "js": [
        "js/core/base-adapter.js",
        "js/adapters/gemini.js"
      ]
    }
  ]
}
```

---

## 国际化 (i18n)

### 目录结构

```
_locales/
├── en/
│   └── messages.json
├── zh_CN/
│   └── messages.json
└── zh_TW/
    └── messages.json
```

### messages.json 示例

```json
{
  "extensionName": {
    "message": "Chat Memo Pro",
    "description": "Extension name"
  },
  "extensionDescription": {
    "message": "Save and manage AI conversations",
    "description": "Extension description"
  },
  "totalConversations": {
    "message": "Total Conversations",
    "description": "Label for total conversations count"
  },
  "exportData": {
    "message": "Export Data",
    "description": "Button text for exporting data"
  }
}
```

### JavaScript 中使用

```javascript
// 获取单个消息
const message = chrome.i18n.getMessage('extensionName');

// 带参数的消息
// messages.json: "greeting": { "message": "Hello, $USERNAME$!" }
const greeting = chrome.i18n.getMessage('greeting', ['John']);

// 封装 i18n 工具类
class I18n {
  static getMessage(key, substitutions = []) {
    return chrome.i18n.getMessage(key, substitutions) || key;
  }

  static initPageI18n() {
    // 自动翻译页面中的 data-i18n 属性
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.getMessage(key);
    });

    // 翻译 placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.getMessage(key);
    });

    // 翻译 title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.title = this.getMessage(key);
    });
  }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  I18n.initPageI18n();
});
```

### HTML 中使用

```html
<!-- 文本内容 -->
<h1 data-i18n="extensionName">Chat Memo Pro</h1>

<!-- Placeholder -->
<input
  type="text"
  data-i18n-placeholder="searchPlaceholder"
  placeholder="Search..."
>

<!-- Title 属性 -->
<button
  data-i18n-title="deleteTooltip"
  title="Delete"
>
  <i class="fas fa-trash"></i>
</button>

<!-- Manifest 中使用 -->
<!-- manifest.json 会自动替换 __MSG_key__ -->
```

---

## 性能优化

### 1. 防抖与节流

```javascript
/**
 * 防抖：延迟执行，适合搜索输入
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// 使用示例
const searchInput = document.getElementById('search');
searchInput.addEventListener('input', debounce((e) => {
  performSearch(e.target.value);
}, 300));

/**
 * 节流：限制执行频率，适合滚动事件
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 使用示例
window.addEventListener('scroll', throttle(() => {
  checkScrollPosition();
}, 100));
```

### 2. MutationObserver 优化

```javascript
class OptimizedObserver {
  constructor(callback, options = {}) {
    this.callback = callback;
    this.debounceDelay = options.debounceDelay || 500;
    this.timeout = null;
    this.observer = null;
  }

  start(target, config = {}) {
    const defaultConfig = {
      childList: true,
      subtree: true,
      attributes: false // 只监听 DOM 变化，不监听属性
    };

    this.observer = new MutationObserver((mutations) => {
      // 过滤无关的变化
      const relevantMutations = mutations.filter(m =>
        this.isRelevantMutation(m)
      );

      if (relevantMutations.length === 0) return;

      // 防抖处理
      if (this.timeout) {
        clearTimeout(this.timeout);
      }

      this.timeout = setTimeout(() => {
        this.callback(relevantMutations);
      }, this.debounceDelay);
    });

    this.observer.observe(target, { ...defaultConfig, ...config });
  }

  isRelevantMutation(mutation) {
    // 过滤掉样式变化、脚本注入等
    if (mutation.type === 'attributes') {
      return false;
    }

    // 检查是否添加了实际内容节点
    const hasContentNodes = Array.from(mutation.addedNodes).some(node =>
      node.nodeType === Node.ELEMENT_NODE &&
      !node.matches('script, style, link')
    );

    return hasContentNodes;
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }
}

// 使用示例
const observer = new OptimizedObserver((mutations) => {
  console.log('相关 DOM 变化:', mutations.length);
  checkForNewMessages();
}, { debounceDelay: 500 });

observer.start(document.body);
```

### 3. 大数据处理

```javascript
/**
 * 分批处理大量数据
 */
async function processBatchData(items, batchSize = 100) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processBatch(batch);
    results.push(...batchResults);

    // 给浏览器喘息的机会
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return results;
}

/**
 * 虚拟滚动（大列表优化）
 */
class VirtualScroller {
  constructor(container, items, rowHeight) {
    this.container = container;
    this.items = items;
    this.rowHeight = rowHeight;
    this.visibleCount = Math.ceil(container.clientHeight / rowHeight) + 2;
    this.startIndex = 0;

    this.render();
    this.container.addEventListener('scroll', () => this.onScroll());
  }

  onScroll() {
    const scrollTop = this.container.scrollTop;
    const newStartIndex = Math.floor(scrollTop / this.rowHeight);

    if (newStartIndex !== this.startIndex) {
      this.startIndex = newStartIndex;
      this.render();
    }
  }

  render() {
    const endIndex = Math.min(
      this.startIndex + this.visibleCount,
      this.items.length
    );

    const visibleItems = this.items.slice(this.startIndex, endIndex);

    // 设置容器高度
    this.container.style.height = `${this.items.length * this.rowHeight}px`;

    // 渲染可见项
    const html = visibleItems.map((item, i) => `
      <div
        class="list-item"
        style="
          position: absolute;
          top: ${(this.startIndex + i) * this.rowHeight}px;
          height: ${this.rowHeight}px;
        "
      >
        ${this.renderItem(item)}
      </div>
    `).join('');

    this.container.innerHTML = html;
  }

  renderItem(item) {
    // 自定义渲染逻辑
    return `<span>${item.title}</span>`;
  }
}
```

### 4. 缓存策略

```javascript
class CacheManager {
  constructor(maxAge = 5 * 60 * 1000) { // 默认5分钟
    this.cache = new Map();
    this.maxAge = maxAge;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) return null;

    // 检查是否过期
    if (Date.now() - item.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  clear() {
    this.cache.clear();
  }

  // 自动清理过期缓存
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.maxAge) {
        this.cache.delete(key);
      }
    }
  }
}

// 使用示例
const cache = new CacheManager(5 * 60 * 1000);

async function fetchData(url) {
  // 先检查缓存
  const cached = cache.get(url);
  if (cached) {
    console.log('返回缓存数据');
    return cached;
  }

  // 获取新数据
  const data = await fetch(url).then(r => r.json());
  cache.set(url, data);

  return data;
}

// 定期清理
setInterval(() => cache.cleanup(), 60 * 1000);
```

---

## 调试与测试

### 1. 控制台日志最佳实践

```javascript
class Logger {
  constructor(prefix = 'Extension') {
    this.prefix = prefix;
    this.isDev = !('update_url' in chrome.runtime.getManifest());
  }

  log(...args) {
    if (this.isDev) {
      console.log(`[${this.prefix}]`, ...args);
    }
  }

  warn(...args) {
    console.warn(`[${this.prefix}]`, ...args);
  }

  error(...args) {
    console.error(`[${this.prefix}]`, ...args);
  }

  group(label) {
    if (this.isDev) {
      console.group(`[${this.prefix}] ${label}`);
    }
  }

  groupEnd() {
    if (this.isDev) {
      console.groupEnd();
    }
  }
}

// 使用示例
const logger = new Logger('ChatMemo');

logger.log('Extension initialized');
logger.warn('API rate limit approaching');
logger.error('Failed to save conversation:', error);

logger.group('Processing messages');
logger.log('Message 1');
logger.log('Message 2');
logger.groupEnd();
```

### 2. 错误处理

```javascript
/**
 * 统一错误处理
 */
class ErrorHandler {
  static async handle(error, context = '') {
    console.error(`Error in ${context}:`, error);

    // 记录到分析服务（生产环境）
    if (!this.isDev()) {
      await this.logToAnalytics(error, context);
    }

    // 显示用户友好的错误消息
    this.showUserMessage(error);
  }

  static isDev() {
    return !('update_url' in chrome.runtime.getManifest());
  }

  static async logToAnalytics(error, context) {
    // 发送到分析服务
    try {
      await fetch('https://your-analytics-endpoint.com/log', {
        method: 'POST',
        body: JSON.stringify({
          error: error.message,
          stack: error.stack,
          context,
          timestamp: Date.now()
        })
      });
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  }

  static showUserMessage(error) {
    // 显示 toast 或通知
    const message = this.getUserFriendlyMessage(error);
    // showToast(message);
  }

  static getUserFriendlyMessage(error) {
    if (error.message.includes('network')) {
      return 'Network error. Please check your connection.';
    }
    if (error.message.includes('storage')) {
      return 'Storage error. Please try again.';
    }
    return 'An error occurred. Please try again.';
  }
}

// 使用示例
async function saveConversation(data) {
  try {
    await db.save(data);
  } catch (error) {
    await ErrorHandler.handle(error, 'saveConversation');
  }
}
```

### 3. 性能监控

```javascript
class PerformanceMonitor {
  static timers = new Map();

  static start(label) {
    this.timers.set(label, performance.now());
  }

  static end(label) {
    const start = this.timers.get(label);
    if (!start) {
      console.warn(`Timer "${label}" not found`);
      return;
    }

    const duration = performance.now() - start;
    console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);

    this.timers.delete(label);
    return duration;
  }

  static async measure(label, fn) {
    this.start(label);
    try {
      const result = await fn();
      return result;
    } finally {
      this.end(label);
    }
  }
}

// 使用示例
PerformanceMonitor.start('extractMessages');
const messages = extractMessages();
PerformanceMonitor.end('extractMessages');

// 或者
const data = await PerformanceMonitor.measure('fetchData', async () => {
  return await fetch('/api/data').then(r => r.json());
});
```

### 4. 调试工具

```javascript
// 暴露调试接口到全局（仅开发环境）
if (!('update_url' in chrome.runtime.getManifest())) {
  window.__DEBUG__ = {
    // 获取所有对话
    async getConversations() {
      return await db.getAll();
    },

    // 清除所有数据
    async clearAll() {
      if (confirm('确定要清除所有数据吗？')) {
        await db.clear();
        console.log('数据已清除');
      }
    },

    // 获取扩展状态
    getState() {
      return {
        sidePanelOpen: sidePanelState,
        settings: settingsManager.get(),
        storageUsage: getStorageUsage()
      };
    },

    // 模拟消息
    sendMessage(type, payload) {
      return chrome.runtime.sendMessage({ type, payload });
    }
  };

  console.log('Debug tools available at window.__DEBUG__');
}
```

---

## 常见陷阱

### 1. ❌ 依赖 Content Script 加载顺序

```javascript
// ❌ 错误：假设 content script 已加载
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.tabs.sendMessage(tab.id, { type: 'toggleSidebar' });
});

// ✅ 正确：使用 Side Panel API
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});
```

### 2. ❌ 没有清理事件监听器

```javascript
// ❌ 错误：重复添加监听器
function init() {
  chrome.runtime.onMessage.addListener(handleMessage);
}
init();
init(); // 重复调用导致监听器重复

// ✅ 正确：确保只添加一次
let messageListenerAdded = false;

function init() {
  if (!messageListenerAdded) {
    chrome.runtime.onMessage.addListener(handleMessage);
    messageListenerAdded = true;
  }
}
```

### 3. ❌ 异步消息响应忘记 return true

```javascript
// ❌ 错误：异步响应但没有 return true
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  fetchData().then(data => {
    sendResponse({ data });
  });
  // 缺少 return true，导致消息通道关闭
});

// ✅ 正确：异步响应时必须 return true
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  fetchData().then(data => {
    sendResponse({ data });
  });
  return true; // 保持消息通道开放
});
```

### 4. ❌ Storage 数据同步问题

```javascript
// ❌ 错误：直接修改对象后保存
const settings = await chrome.storage.sync.get('settings');
settings.autoSave = true;
await chrome.storage.sync.set(settings); // 这不会生效！

// ✅ 正确：正确处理嵌套对象
const result = await chrome.storage.sync.get('settings');
const settings = result.settings || {};
settings.autoSave = true;
await chrome.storage.sync.set({ settings }); // 包裹在对象中
```

### 5. ❌ MutationObserver 性能问题

```javascript
// ❌ 错误：每次变化都处理
new MutationObserver((mutations) => {
  processMessages(); // 频繁调用
}).observe(document.body, { childList: true, subtree: true });

// ✅ 正确：使用防抖
let timeout;
new MutationObserver((mutations) => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    processMessages();
  }, 500);
}).observe(document.body, { childList: true, subtree: true });
```

### 6. ❌ 窗口/标签页关闭时未清理

```javascript
// ❌ 错误：没有清理状态
const windowStates = new Map();

chrome.action.onClicked.addListener((tab) => {
  windowStates.set(tab.windowId, { open: true });
});

// ✅ 正确：监听窗口关闭事件
chrome.windows.onRemoved.addListener((windowId) => {
  windowStates.delete(windowId);
  console.log(`清理窗口 ${windowId} 的状态`);
});
```

### 7. ❌ 硬编码 URL

```javascript
// ❌ 错误：硬编码 URL
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: 'https://example.com/welcome' });
});

// ✅ 正确：使用配置或环境变量
const config = {
  welcomeUrl: chrome.runtime.getManifest().homepage_url ||
              'https://github.com/your-repo'
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: config.welcomeUrl });
});
```

---

## 开发流程建议

### 1. 项目结构

```
extension/
├── manifest.json
├── _locales/
│   ├── en/messages.json
│   └── zh_CN/messages.json
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── html/
│   ├── sidebar.html
│   └── options.html
├── css/
│   ├── sidebar.css
│   └── content.css
├── js/
│   ├── background.js
│   ├── sidebar.js
│   ├── core/
│   │   ├── base-adapter.js
│   │   ├── storage-manager.js
│   │   └── message-handler.js
│   └── adapters/
│       ├── chatgpt.js
│       ├── claude.js
│       └── gemini.js
└── lib/
    ├── fuse.min.js
    └── jszip.min.js
```

### 2. 版本控制

- 使用语义化版本号 (Semantic Versioning)
  - 主版本号：不兼容的 API 变更
  - 次版本号：向后兼容的功能性新增
  - 修订号：向后兼容的问题修正

### 3. 测试清单

- [ ] 首次安装测试
- [ ] 更新测试（从旧版本升级）
- [ ] 多窗口测试
- [ ] 权限请求测试
- [ ] 离线功能测试
- [ ] 大数据量测试
- [ ] 各平台兼容性测试
- [ ] 国际化测试（多语言）

### 4. 发布前检查

- [ ] 移除所有 console.log（或条件化）
- [ ] 更新 manifest.json 版本号
- [ ] 更新 CHANGELOG.md
- [ ] 压缩图片资源
- [ ] 检查权限是否最小化
- [ ] 测试所有功能
- [ ] 准备应用商店截图和描述

---

## 参考资源

### 官方文档
- [Chrome Extensions Developer Guide](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Side Panel API](https://developer.chrome.com/docs/extensions/reference/sidePanel/)

### 工具库
- [Fuse.js](https://fusejs.io/) - 模糊搜索
- [JSZip](https://stuk.github.io/jszip/) - ZIP 文件处理
- [Dexie.js](https://dexie.org/) - IndexedDB 封装

### 社区资源
- [awesome-browser-extensions](https://github.com/fregante/Awesome-WebExtensions)
- [webextension-polyfill](https://github.com/mozilla/webextension-polyfill)

---

## 总结

### 核心要点

1. **使用 Side Panel API** - 100% 可靠的侧边栏方案
2. **适配器模式** - 优雅处理多平台差异
3. **消息传递规范** - 统一的消息格式和错误处理
4. **性能优化** - 防抖、节流、虚拟滚动
5. **错误处理** - 完善的错误捕获和用户提示
6. **国际化支持** - 完整的 i18n 实现
7. **状态管理** - 集中式状态管理，避免状态混乱

### 避免的陷阱

- ❌ 依赖 Content Script 加载顺序
- ❌ 忘记清理事件监听器和状态
- ❌ 异步消息响应忘记 return true
- ❌ MutationObserver 性能问题
- ❌ 硬编码配置信息

### 开发建议

- 优先使用浏览器原生 API
- 保持代码模块化和可复用
- 重视性能和用户体验
- 完善的错误处理和日志
- 持续测试和迭代

---

**最后更新**: 2025-12-11
**作者**: Eze & Jack
**项目**: Chat Memo Pro
