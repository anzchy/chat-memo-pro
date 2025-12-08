# Chat Memo Pro - Enhancement Analysis

**Document Version**: 2.0
**Date**: 2024-12-08
**Analysis Base**: Comparison between existing `chat-memo-pro` extension and `specs/001-core-enhanced-features/plan.md`
**Architecture**: Vanilla JavaScript (No React/TypeScript migration)

---

## Executive Summary

This document analyzes the current **Chat Memo** extension (located in `chat-memo-pro/` folder) and compares it against the proposed **Chat Memo Pro** enhancements outlined in the specification documents. The analysis identifies which features are already implemented, which are missing, and what technical gaps exist.

**Current Extension Stats**:
- **Total Code**: ~9,442 lines of JavaScript
- **Supported Platforms**: 7 (ChatGPT, Claude, Gemini, DeepSeek, Doubao, Kimi, Yuanbao)
- **Storage**: IndexedDB for conversations, chrome.storage.sync for settings
- **Tech Stack**: Vanilla JavaScript, Tailwind CSS, JSZip, FontAwesome
- **Architecture**: Manifest V3, Service Worker background, Content Scripts with Platform Adapters

---

## 🎯 Current Priority: New Platform Adapters

### Priority 1: Manus Platform Adapter (HIGH)

**Platform**: Manus.im - AI-powered task execution platform
**URL Pattern**: `https://manus.im/app/*`
**Example URL**: `https://manus.im/app/V8Gl1FEzaqOJTEchQ0CPAJ`

**Unique Challenges**:
- **Task-oriented**: Each conversation is an independent task, not continuous dialogue
- **Complex response structure**: AI responses include multiple parts (initial reply, thinking process, action steps, final results, code files, terminal output)
- **No semantic markup**: Lacks clear message containers like `[data-role="user"]`
- **Dynamic content**: Page content updates dynamically during task execution

**Implementation Strategy - Heuristic Text Analysis**:

```javascript
class ManusAdapter extends BasePlatformAdapter {
  constructor() {
    super('manus');
    this.lastExtractedContent = '';
    this.retryCount = 0;
    this.maxRetries = 10;
  }

  /**
   * 验证是否为有效的Manus对话URL
   */
  isValidConversationUrl(url) {
    return /^https:\/\/manus\.im\/app\/[A-Za-z0-9]+/.test(url);
  }

  /**
   * 从URL中提取任务ID
   */
  extractConversationInfo(url) {
    const match = url.match(/\/app\/([A-Za-z0-9]+)/);
    return {
      conversationId: match ? `manus_${match[1]}` : null,
      isNewConversation: false
    };
  }

  /**
   * 提取用户消息（基于文本特征识别）
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
   * 判断是否像用户消息
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
   * 提取AI响应（捕获多部分内容）
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
   * 过滤UI元素
   */
  isUIElement(text) {
    const uiPatterns = [
      'New task', 'Search', 'Library', 'Projects',
      'Share Manus', 'Manus 1.5', '优化指令', 'Settings'
    ];
    return uiPatterns.some(pattern => text.includes(pattern));
  }

  /**
   * 提取页面消息
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
   */
  isMessageElement(node) {
    // Manus没有明确的消息元素标记
    // 依赖MutationObserver触发后的完整提取
    return false;
  }

  /**
   * 提取标题
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
```

**File Location**: `chat-memo-pro/js/adapters/manus.js`

**Manifest.json Update**:
```json
{
  "js": [
    "js/core/compatibility.js",
    "js/core/storage-manager.js",
    "js/core/base.js",
    "js/adapters/manus.js"
  ],
  "matches": ["https://manus.im/*"]
}
```

**Implementation Effort**: 2-3 days
**Testing Priority**: HIGH - Due to complex heuristic logic, needs thorough manual testing

---

### Priority 2: Genspark Platform Adapter (MEDIUM)

**Platform**: Genspark.ai - AI Workspace with Super Agent
**URL Pattern**: `https://www.genspark.ai/agents?id=*`
**Example URL**: `https://www.genspark.ai/agents?id=8fd43b61-56a1-41a8-b5de-acb120da0752`

**Platform Features**:
- Multi-function AI workspace (Super Agent, AI Chat, AI Slides, AI Docs)
- Clear distinction between user messages and AI responses
- Markdown formatting in AI responses
- Page title updates with conversation topic

**Implementation Strategy - Standard Selector Approach**:

```javascript
class GensparkAdapter extends BasePlatformAdapter {
  constructor() {
    super('genspark');
  }

  /**
   * 验证是否为有效的Genspark对话URL
   */
  isValidConversationUrl(url) {
    return /^https:\/\/www\.genspark\.ai\/agents\?id=/.test(url);
  }

  /**
   * 从URL中提取对话ID
   */
  extractConversationInfo(url) {
    const urlObj = new URL(url);
    const conversationId = urlObj.searchParams.get('id');

    return {
      conversationId: conversationId ? `genspark_${conversationId}` : null,
      isNewConversation: false
    };
  }

  /**
   * 提取页面消息
   */
  extractMessages() {
    const messages = [];

    // 查找对话容器
    const container = document.querySelector('main') ||
                     document.querySelector('[role="main"]') ||
                     document.querySelector('.conversation-container');

    if (!container) {
      console.log('Keep AI Memory (Genspark): 未找到对话容器');
      return messages;
    }

    // 策略：使用多层fallback选择器
    const messageSelectors = [
      // 尝试通过class查找
      '[class*="message"]',
      '[class*="chat"]',
      '[class*="conversation"]',
      // 尝试通过结构查找
      'div[class*="flex"]',
      'div > div'
    ];

    let messageElements = [];
    for (const selector of messageSelectors) {
      messageElements = container.querySelectorAll(selector);
      if (messageElements.length > 0) {
        console.log(`Keep AI Memory (Genspark): 使用选择器 ${selector} 找到 ${messageElements.length} 个元素`);
        break;
      }
    }

    messageElements.forEach((element) => {
      const text = element.innerText?.trim();
      if (!text || text.length < 5) return;

      // 判断消息角色（基于布局和class）
      let role = 'assistant'; // 默认AI响应

      const classNames = element.className || '';
      const style = window.getComputedStyle(element);

      // 用户消息通常右对齐
      if (classNames.includes('user') ||
          classNames.includes('query') ||
          style.textAlign === 'right' ||
          style.justifyContent === 'flex-end') {
        role = 'user';
      }

      // AI消息通常左对齐
      if (classNames.includes('assistant') ||
          classNames.includes('response') ||
          classNames.includes('ai')) {
        role = 'assistant';
      }

      messages.push({
        role: role,
        content: text,
        timestamp: Date.now()
      });
    });

    console.log(`Keep AI Memory (Genspark): 提取到 ${messages.length} 条消息`);
    return messages;
  }

  /**
   * 检查元素是否为消息元素
   */
  isMessageElement(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    const classNames = node.className || '';

    // 检查是否包含消息相关class
    return classNames.includes('message') ||
           classNames.includes('chat') ||
           classNames.includes('user') ||
           classNames.includes('assistant') ||
           classNames.includes('response');
  }

  /**
   * 提取标题
   */
  extractTitle() {
    // 尝试从页面标题提取
    const title = document.title;
    if (title && !title.includes('Genspark')) {
      return title;
    }

    // 尝试从页面中查找标题元素
    const titleElement = document.querySelector('h1') ||
                        document.querySelector('[class*="title"]');
    if (titleElement) {
      return titleElement.innerText.trim();
    }

    return 'Genspark Conversation';
  }
}

// 初始化
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const adapter = new GensparkAdapter();
    adapter.init();
  });
}
```

**File Location**: `chat-memo-pro/js/adapters/genspark.js`

**Manifest.json Update**:
```json
{
  "js": [
    "js/core/compatibility.js",
    "js/core/storage-manager.js",
    "js/core/base.js",
    "js/adapters/genspark.js"
  ],
  "matches": ["https://www.genspark.ai/*"]
}
```

**Implementation Effort**: 1-2 days
**Testing Priority**: MEDIUM - Standard adapter pattern, lower complexity

---

## Feature Comparison Matrix

### ✅ **Already Implemented Features**

| Feature ID | Feature Name | Implementation Status | Evidence |
|-----------|--------------|----------------------|----------|
| **Phase 0** | Foundation Architecture | ✅ **COMPLETE** | Manifest V3 structure exists, IndexedDB functional |
| **Phase 1** | Core Auto-Save | ✅ **COMPLETE** | All 7 platform adapters implemented (ChatGPT, Claude, Gemini, DeepSeek, Doubao, Kimi, Yuanbao) |
| FR-001 | Multi-Platform Support | ✅ **COMPLETE** | Supports ChatGPT, Gemini, Claude + 4 additional platforms |
| FR-002 | Extended Platform Support | ⏳ **IN PROGRESS** | Manus & Genspark adapters planned |
| FR-003 | Message Capture | ✅ **COMPLETE** | Captures user/assistant messages, thinking blocks |
| FR-028 | IndexedDB Storage | ✅ **COMPLETE** | `background.js:287` - IndexedDB implementation |
| **Phase 5** | Conversation Management | ✅ **COMPLETE** | View, copy, delete, jump to original - all functional |
| FR-023 | Conversation Detail View | ✅ **COMPLETE** | `popup.js` implements full detail view with messages |
| FR-024 | Copy to Clipboard | ✅ **COMPLETE** | Copy conversation functionality exists |
| FR-025 | Jump to Original | ✅ **COMPLETE** | Opens platform URL in new tab |
| FR-026/027 | Delete Conversation | ✅ **COMPLETE** | Delete with confirmation modal |
| **Phase 6** | Basic Export | ✅ **PARTIAL** | Export exists but lacks planned enhancements |
| FR-032 | Export Modes | ✅ **COMPLETE** | Multiple Files (ZIP) and Single Document (Merged) |
| FR-035 | JSZip Integration | ✅ **COMPLETE** | `lib/jszip.min.js` included |
| **Phase 7** | Storage Management | ✅ **COMPLETE** | Storage usage display, clear all functionality |
| **Phase 2** | Floating Status Indicator | ✅ **COMPLETE** | `content_common.js` implements draggable floating tag |
| FR-018-022 | Floating Indicator Features | ✅ **COMPLETE** | Draggable, position persistence, edge snapping |

### ❌ **Missing/Incomplete Features**

| Feature ID | Feature Name | Status | Gap Description |
|-----------|--------------|--------|-----------------|
| **Phase 3** | Resizable Sidebar | ❌ **MISSING** | No resize functionality detected. Popup is fixed-width. |
| FR-004-009 | Sidebar Resizing | ❌ **MISSING** | No ResizablePanel component, no width adjustment (320-800px) |
| FR-007 | Responsive Breakpoints | ❌ **MISSING** | No CSS Grid/Flexbox breakpoints at <450px, ≥450px |
| FR-009 | Width Persistence | ❌ **MISSING** | No localStorage for sidebar width |
| **Phase 4** | Advanced Search & Filter | ❌ **PARTIAL** | Basic search exists, but missing fuzzy search and AND logic |
| FR-014 | Fuzzy Search (Fuse.js) | ❌ **MISSING** | No Fuse.js library found. Current search is basic string matching |
| FR-015 | Keyword Highlighting | ❌ **MISSING** | No highlighting in search results |
| FR-016 | Sort by Relevance | ❌ **MISSING** | Only date sorting available |
| FR-038 | AND Logic Filtering | ⚠️ **UNCLEAR** | Need to verify if filters combine with AND logic |
| FR-011-013 | Date Range Filters | ✅ **PARTIAL** | Date filters exist (`start-date`, `end-date`) but need timestamp validation |
| FR-041-042 | Timestamp-based Filtering | ⚠️ **UNCLEAR** | Need to verify if using timestamps vs date strings |
| **Phase 6** | Enhanced Export | ❌ **PARTIAL** | Export exists but missing wizard UI and validation |
| FR-010 | 3-Step Export Wizard | ❌ **MISSING** | No step-by-step card UI. Current: simple dropdown menu |
| FR-039 | Time Range Selection | ❌ **MISSING** | No time range presets in export (All Time, Last Week, etc.) |
| FR-040 | Export Validation (AND Logic) | ❌ **MISSING** | No requirement that all 3 steps complete before export |
| FR-037 | Export Preview Card | ❌ **MISSING** | No preview showing conversation count, estimated size |
| FR-033 | Plain Text Export | ❌ **MISSING** | Only Markdown detected, no `.txt` format |
| FR-034 | File Naming Convention | ⚠️ **UNCLEAR** | Need to verify if follows `[platform]_[YYYYMMDDHHMMSS]_[title].ext` |
| FR-036 | Markdown Frontmatter | ⚠️ **UNCLEAR** | Need to verify if exports include YAML frontmatter |

---

## Implementation Priority & Roadmap

### 🔥 Phase 1: Platform Adapters (Current Priority - Week 1-2)

**Objective**: Add support for Manus and Genspark platforms

**Tasks**:
- [ ] Implement Manus adapter with heuristic text analysis (`js/adapters/manus.js`)
- [ ] Implement Genspark adapter with standard selectors (`js/adapters/genspark.js`)
- [ ] Update `manifest.json` with new content script matches
- [ ] Update platform name mappings in `background.js` and `popup.js`
- [ ] Manual testing on both platforms (10+ conversations each)
- [ ] Document edge cases and limitations

**Deliverables**:
- Working auto-save on Manus.im
- Working auto-save on Genspark.ai
- Total platform support: 9 platforms

**Exit Criteria**:
- Messages captured within 5 seconds (SC-001)
- At least 10 test conversations saved per platform
- No duplicate messages in storage
- Floating indicator shows sync status correctly

---

### Phase 2: Search Enhancements (Week 3-4)

**Objective**: Add fuzzy search with keyword highlighting

**Tasks**:
- [ ] Add Fuse.js library to `lib/` folder
- [ ] Replace basic string search with fuzzy matching
- [ ] Implement keyword highlighting in search results
- [ ] Add sort by relevance option
- [ ] Validate AND logic for filter combinations
- [ ] Verify timestamp-based date filtering

**Implementation**:

**1. Add Fuse.js Library**:
```bash
# Download Fuse.js
curl -o chat-memo-pro/lib/fuse.min.js https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js

# Update popup.html
<script src="../lib/fuse.min.js"></script>
```

**2. Modify popup.js Search Function**:
```javascript
// Initialize Fuse.js
let fuseInstance = null;

function initializeFuzzySearch(conversations) {
  fuseInstance = new Fuse(conversations, {
    keys: [
      { name: 'title', weight: 2 },
      { name: 'messages.content', weight: 1 },
      { name: 'messages.thinking', weight: 0.5 }
    ],
    threshold: 0.3,
    includeMatches: true, // For highlighting
    includeScore: true,   // For sorting by relevance
    minMatchCharLength: 2
  });
}

function performFuzzySearch(query) {
  if (!fuseInstance) return [];

  const results = fuseInstance.search(query);

  // Extract conversations with match info
  return results.map(result => ({
    conversation: result.item,
    matches: result.matches,
    score: result.score
  }));
}

function highlightMatches(text, matches) {
  if (!matches || matches.length === 0) return text;

  let highlightedText = text;

  // Sort matches by position (reverse to avoid index shifting)
  const sortedMatches = matches.sort((a, b) => b.indices[0][0] - a.indices[0][0]);

  sortedMatches.forEach(match => {
    match.indices.forEach(([start, end]) => {
      const before = highlightedText.substring(0, start);
      const matched = highlightedText.substring(start, end + 1);
      const after = highlightedText.substring(end + 1);

      highlightedText = before + `<mark class="highlight">${matched}</mark>` + after;
    });
  });

  return highlightedText;
}

// Apply filters with AND logic
function applyFilters(conversations, filters) {
  return conversations.filter(conv => {
    // Keyword match (fuzzy)
    const matchesKeyword = !filters.keyword ||
      performFuzzySearch(filters.keyword).some(r => r.conversation.id === conv.id);

    // Date range match (timestamp-based)
    const matchesDate = !filters.dateRange || (
      conv.createdAt >= filters.dateRange[0] &&
      conv.createdAt <= filters.dateRange[1]
    );

    // Platform match
    const matchesPlatform = !filters.platforms?.length ||
      filters.platforms.includes(conv.platform);

    // AND logic: all conditions must be true
    return matchesKeyword && matchesDate && matchesPlatform;
  });
}

// Sort results
function sortResults(results, sortBy) {
  if (sortBy === 'relevance') {
    return results.sort((a, b) => a.score - b.score); // Lower score = better match
  } else if (sortBy === 'date') {
    return results.sort((a, b) => b.conversation.updatedAt - a.conversation.updatedAt);
  }
  return results;
}
```

**3. Add CSS for Highlighting**:
```css
/* Add to popup.html <style> */
mark.highlight {
  background-color: #fef08a; /* Yellow highlight */
  color: #000;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 500;
}
```

**Effort**: 1 week
**Impact**: High (FR-014, FR-015, FR-016, FR-038)

---

### Phase 3: Export Wizard UI (Week 5-6)

**Objective**: Build 3-step export wizard with time filters and validation

**Tasks**:
- [ ] Design card-based wizard UI
- [ ] Implement Step 1: Time Range Selection (presets + custom)
- [ ] Implement Step 2: Export Mode Selection
- [ ] Implement Step 3: File Format Selection
- [ ] Add Export Preview Card
- [ ] Implement AND logic validation (all 3 steps required)
- [ ] Add Plain Text export format
- [ ] Verify file naming convention
- [ ] Add Markdown frontmatter

**Implementation**:

**1. HTML Structure (Replace existing export dropdown)**:
```html
<div id="export-wizard" class="hidden">
  <!-- Step 1: Time Range -->
  <div class="wizard-step" id="step-time">
    <h3 class="font-semibold mb-2">Step 1: Choose Time Range</h3>
    <div class="grid grid-cols-3 gap-2 mb-3">
      <button class="preset-btn" data-range="all">All Time</button>
      <button class="preset-btn" data-range="week">Last Week</button>
      <button class="preset-btn" data-range="month">Last Month</button>
      <button class="preset-btn" data-range="3months">Last 3 Months</button>
      <button class="preset-btn" data-range="year">Last Year</button>
      <button class="preset-btn" data-range="custom">Custom Range</button>
    </div>

    <div id="custom-date-range" class="hidden">
      <label>Start Time: <input type="datetime-local" id="export-start-time"></label>
      <label>End Time: <input type="datetime-local" id="export-end-time"></label>
    </div>
  </div>

  <!-- Step 2: Export Mode -->
  <div class="wizard-step" id="step-mode">
    <h3 class="font-semibold mb-2">Step 2: Choose Export Mode</h3>
    <div class="grid grid-cols-2 gap-2">
      <button class="mode-btn" data-mode="multiple">
        <i class="fas fa-file-archive"></i> Multiple Files (ZIP)
      </button>
      <button class="mode-btn" data-mode="single">
        <i class="fas fa-file"></i> Single Document
      </button>
    </div>
  </div>

  <!-- Step 3: File Format -->
  <div class="wizard-step" id="step-format">
    <h3 class="font-semibold mb-2">Step 3: Choose File Format</h3>
    <div class="grid grid-cols-3 gap-2">
      <button class="format-btn" data-format="md">
        <i class="fab fa-markdown"></i> Markdown
      </button>
      <button class="format-btn" data-format="json">
        <i class="fas fa-code"></i> JSON
      </button>
      <button class="format-btn" data-format="txt">
        <i class="fas fa-file-alt"></i> Plain Text
      </button>
    </div>
  </div>

  <!-- Export Preview -->
  <div class="export-preview-card mt-4 p-3 bg-blue-50 rounded">
    <h4 class="font-semibold mb-2">Export Preview</h4>
    <div class="text-sm">
      <p>Time Range: <span id="preview-time">Not selected</span></p>
      <p>Mode: <span id="preview-mode">Not selected</span></p>
      <p>Format: <span id="preview-format">Not selected</span></p>
      <p>Conversations: <span id="preview-count">-</span></p>
      <p>Output: <span id="preview-output">-</span></p>
      <p>Estimated Size: <span id="preview-size">-</span></p>
    </div>
  </div>

  <!-- Start Export Button (disabled until all steps complete) -->
  <button id="start-export-btn" class="btn-primary mt-4 w-full" disabled>
    <i class="fas fa-download"></i> Start Export
  </button>
</div>
```

**2. JavaScript Logic**:
```javascript
const exportWizard = {
  timeRange: null,
  customDateRange: null,
  mode: null,
  format: null,

  init() {
    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectTimeRange(e.target.dataset.range);
      });
    });

    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectMode(e.target.dataset.mode);
      });
    });

    // Format buttons
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectFormat(e.target.dataset.format);
      });
    });

    // Start export
    document.getElementById('start-export-btn').addEventListener('click', () => {
      this.startExport();
    });
  },

  selectTimeRange(range) {
    this.timeRange = range;

    if (range === 'custom') {
      document.getElementById('custom-date-range').classList.remove('hidden');
    } else {
      document.getElementById('custom-date-range').classList.add('hidden');
      this.customDateRange = this.calculateDateRange(range);
    }

    this.updatePreview();
    this.validateForm();
  },

  calculateDateRange(preset) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    switch (preset) {
      case 'all':
        return [0, now];
      case 'week':
        return [now - 7 * day, now];
      case 'month':
        return [now - 30 * day, now];
      case '3months':
        return [now - 90 * day, now];
      case 'year':
        return [now - 365 * day, now];
      default:
        return null;
    }
  },

  selectMode(mode) {
    this.mode = mode;
    this.updatePreview();
    this.validateForm();
  },

  selectFormat(format) {
    this.format = format;
    this.updatePreview();
    this.validateForm();
  },

  validateForm() {
    // AND logic: all 3 steps must be complete
    const isValid = this.timeRange && this.mode && this.format;

    // If custom date range, validate dates
    if (this.timeRange === 'custom') {
      const startTime = document.getElementById('export-start-time').value;
      const endTime = document.getElementById('export-end-time').value;
      const isValid = startTime && endTime;
    }

    document.getElementById('start-export-btn').disabled = !isValid;
  },

  updatePreview() {
    // Update time range display
    if (this.timeRange) {
      document.getElementById('preview-time').textContent =
        this.timeRange === 'custom' ? 'Custom Range' : this.timeRange;
    }

    // Update mode display
    if (this.mode) {
      document.getElementById('preview-mode').textContent =
        this.mode === 'multiple' ? 'Multiple Files (ZIP)' : 'Single Document';
    }

    // Update format display
    if (this.format) {
      const formatNames = { md: 'Markdown', json: 'JSON', txt: 'Plain Text' };
      document.getElementById('preview-format').textContent = formatNames[this.format];
    }

    // Calculate filtered conversation count
    if (this.timeRange && this.customDateRange) {
      const filtered = allConversations.filter(conv =>
        conv.createdAt >= this.customDateRange[0] &&
        conv.createdAt <= this.customDateRange[1]
      );
      document.getElementById('preview-count').textContent = filtered.length;

      // Estimate size
      const estimatedSize = this.estimateSize(filtered);
      document.getElementById('preview-size').textContent = estimatedSize;

      // Output description
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
      if (this.mode === 'multiple') {
        document.getElementById('preview-output').textContent =
          `${filtered.length} files in conversations_${timestamp}.zip`;
      } else {
        document.getElementById('preview-output').textContent =
          `conversations_export_${timestamp}.${this.format}`;
      }
    }
  },

  estimateSize(conversations) {
    let totalChars = 0;
    conversations.forEach(conv => {
      conv.messages.forEach(msg => {
        totalChars += msg.content.length;
      });
    });

    // Rough estimate: 1 char ≈ 1 byte
    const bytes = totalChars;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  },

  startExport() {
    // Perform export based on selected options
    const filtered = this.filterConversations();

    if (this.format === 'md') {
      this.exportAsMarkdown(filtered);
    } else if (this.format === 'json') {
      this.exportAsJSON(filtered);
    } else if (this.format === 'txt') {
      this.exportAsPlainText(filtered);
    }
  },

  filterConversations() {
    return allConversations.filter(conv => {
      const dateRange = this.timeRange === 'custom'
        ? [
            new Date(document.getElementById('export-start-time').value).getTime(),
            new Date(document.getElementById('export-end-time').value).getTime()
          ]
        : this.customDateRange;

      return conv.createdAt >= dateRange[0] && conv.createdAt <= dateRange[1];
    });
  },

  exportAsMarkdown(conversations) {
    // Add frontmatter
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];

    conversations.forEach(conv => {
      const frontmatter = `---
title: "${conv.title}"
platform: ${conv.platform}
created: ${new Date(conv.createdAt).toISOString()}
updated: ${new Date(conv.updatedAt).toISOString()}
messages: ${conv.messages.length}
url: ${conv.url || 'N/A'}
---

# ${conv.title}

**Platform**: ${PLATFORM_NAMES[conv.platform] || conv.platform}
**Created**: ${new Date(conv.createdAt).toLocaleString()}

---

`;

      let markdown = frontmatter;
      conv.messages.forEach(msg => {
        markdown += `## ${msg.role === 'user' ? 'User' : 'Assistant'}\n\n`;
        markdown += `${msg.content}\n\n`;
        if (msg.thinking) {
          markdown += `### Thinking\n\n${msg.thinking}\n\n`;
        }
      });

      // File naming: [platform]_[YYYYMMDDHHMMSS]_[title].md
      const sanitizedTitle = conv.title.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
      const filename = `${conv.platform}_${timestamp}_${sanitizedTitle}.md`;

      // Save or add to ZIP
      if (this.mode === 'multiple') {
        // Add to ZIP (implement with JSZip)
      } else {
        // Download single file
        this.downloadFile(filename, markdown);
      }
    });
  },

  exportAsPlainText(conversations) {
    conversations.forEach(conv => {
      let text = `${conv.title}\n`;
      text += `Platform: ${PLATFORM_NAMES[conv.platform] || conv.platform}\n`;
      text += `Created: ${new Date(conv.createdAt).toLocaleString()}\n\n`;
      text += '='.repeat(50) + '\n\n';

      conv.messages.forEach(msg => {
        text += `[${msg.role === 'user' ? 'User' : 'Assistant'}]:\n${msg.content}\n\n`;
      });

      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
      const sanitizedTitle = conv.title.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
      const filename = `${conv.platform}_${timestamp}_${sanitizedTitle}.txt`;

      if (this.mode === 'single') {
        this.downloadFile(filename, text);
      }
    });
  },

  downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};

// Initialize wizard
exportWizard.init();
```

**Effort**: 2 weeks
**Impact**: High (FR-010, FR-037, FR-039-042, User Story 3)

---

### Phase 4: Resizable Sidebar (Week 7-8)

**Objective**: Add sidebar resizing with responsive breakpoints

**Tasks**:
- [ ] Create ResizablePanel component
- [ ] Add resize handle (5px right edge)
- [ ] Implement width constraints (320-800px)
- [ ] Add responsive CSS breakpoints
- [ ] Persist width to localStorage
- [ ] Test on different screen sizes

**Implementation**:

```javascript
// File: js/resizable-panel.js
class ResizablePanel {
  constructor(element, options = {}) {
    this.element = element;
    this.minWidth = options.minWidth || 320;
    this.maxWidth = options.maxWidth || 800;
    this.defaultWidth = options.defaultWidth || 400;

    // Load saved width or use default
    this.currentWidth = parseInt(localStorage.getItem('sidebarWidth')) || this.defaultWidth;

    this.isResizing = false;
    this.startX = 0;
    this.startWidth = 0;

    this.init();
  }

  init() {
    // Set initial width
    this.element.style.width = `${this.currentWidth}px`;

    // Create resize handle
    this.createResizeHandle();

    // Apply responsive classes
    this.updateResponsiveClasses();

    // Attach event listeners
    this.attachEventListeners();
  }

  createResizeHandle() {
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.style.cssText = `
      position: absolute;
      right: 0;
      top: 0;
      width: 5px;
      height: 100%;
      cursor: col-resize;
      background: transparent;
      z-index: 1000;
    `;

    // Visual indicator on hover
    handle.addEventListener('mouseenter', () => {
      handle.style.background = 'rgba(59, 130, 246, 0.5)';
    });

    handle.addEventListener('mouseleave', () => {
      if (!this.isResizing) {
        handle.style.background = 'transparent';
      }
    });

    this.element.style.position = 'relative';
    this.element.appendChild(handle);
    this.handle = handle;
  }

  attachEventListeners() {
    this.handle.addEventListener('mousedown', (e) => {
      this.startResize(e);
    });

    document.addEventListener('mousemove', (e) => {
      this.resize(e);
    });

    document.addEventListener('mouseup', () => {
      this.stopResize();
    });
  }

  startResize(e) {
    this.isResizing = true;
    this.startX = e.clientX;
    this.startWidth = this.element.offsetWidth;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  resize(e) {
    if (!this.isResizing) return;

    const delta = e.clientX - this.startX;
    let newWidth = this.startWidth + delta;

    // Enforce constraints
    newWidth = Math.max(this.minWidth, Math.min(this.maxWidth, newWidth));

    this.currentWidth = newWidth;
    this.element.style.width = `${newWidth}px`;

    // Update responsive classes
    this.updateResponsiveClasses();

    // Show width tooltip (optional)
    this.showWidthTooltip(newWidth);
  }

  stopResize() {
    if (!this.isResizing) return;

    this.isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Save to localStorage
    localStorage.setItem('sidebarWidth', this.currentWidth);

    this.hideWidthTooltip();
  }

  updateResponsiveClasses() {
    // Apply breakpoint classes for CSS to use
    if (this.currentWidth < 450) {
      this.element.classList.add('sidebar-narrow');
      this.element.classList.remove('sidebar-wide');
    } else {
      this.element.classList.add('sidebar-wide');
      this.element.classList.remove('sidebar-narrow');
    }
  }

  showWidthTooltip(width) {
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 10000;
      `;
      document.body.appendChild(this.tooltip);
    }

    this.tooltip.textContent = `${width}px`;
    this.tooltip.style.display = 'block';
  }

  hideWidthTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }
}

// Initialize on popup load
document.addEventListener('DOMContentLoaded', () => {
  const mainContainer = document.querySelector('body');
  new ResizablePanel(mainContainer, {
    minWidth: 320,
    maxWidth: 800,
    defaultWidth: 400
  });
});
```

**CSS Responsive Breakpoints**:
```css
/* Add to popup.html <style> */

/* Base layout */
.stats-container {
  display: grid;
  gap: 1rem;
  transition: grid-template-columns 0.2s ease;
}

/* Narrow sidebar (<450px) */
.sidebar-narrow .stats-container {
  grid-template-columns: 1fr;
}

.sidebar-narrow .preview-text {
  -webkit-line-clamp: 1;
}

/* Wide sidebar (≥450px) */
.sidebar-wide .stats-container {
  grid-template-columns: 1fr 1fr;
}

.sidebar-wide .preview-text {
  -webkit-line-clamp: 2;
}

/* Very wide sidebar (>600px) */
body:not(.sidebar-narrow) .sidebar-wide .preview-text {
  -webkit-line-clamp: 3;
}
```

**Effort**: 1-2 weeks
**Impact**: High (FR-004-009, User Story 2)

---

## Testing Strategy

### Unit Tests (Optional but Recommended)

Use simple assertion library for critical functions:

```javascript
// File: tests/test-runner.js
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Test export wizard validation
function testExportWizardValidation() {
  exportWizard.timeRange = 'all';
  exportWizard.mode = null;
  exportWizard.format = null;

  exportWizard.validateForm();
  assert(
    document.getElementById('start-export-btn').disabled === true,
    'Export button should be disabled when mode and format are not selected'
  );

  exportWizard.mode = 'multiple';
  exportWizard.format = 'md';
  exportWizard.validateForm();

  assert(
    document.getElementById('start-export-btn').disabled === false,
    'Export button should be enabled when all steps complete'
  );
}

// Test fuzzy search
function testFuzzySearch() {
  const mockConversations = [
    { id: '1', title: 'React Hooks Tutorial', messages: [] },
    { id: '2', title: 'Vue.js Components', messages: [] }
  ];

  initializeFuzzySearch(mockConversations);
  const results = performFuzzySearch('react');

  assert(results.length > 0, 'Should find "React Hooks Tutorial"');
  assert(results[0].conversation.id === '1', 'Should return correct conversation');
}

// Run tests
console.log('Running tests...');
testExportWizardValidation();
testFuzzySearch();
console.log('All tests passed!');
```

### Manual Testing Checklist

**Manus Adapter**:
- [ ] Open 5+ different Manus tasks
- [ ] Verify user messages captured correctly
- [ ] Verify AI responses include all parts (thinking, steps, results)
- [ ] Verify no UI elements in saved content
- [ ] Check duplicate prevention

**Genspark Adapter**:
- [ ] Open 5+ Genspark conversations
- [ ] Verify user/AI message distinction
- [ ] Verify Markdown preserved in AI responses
- [ ] Check conversation title extraction

**Fuzzy Search**:
- [ ] Search with typos (e.g., "recat" → "React")
- [ ] Verify keyword highlighting
- [ ] Test sort by relevance vs date
- [ ] Validate AND logic (keyword + date + platform)

**Export Wizard**:
- [ ] Verify button disabled until all steps complete
- [ ] Test all time range presets
- [ ] Test custom date range with timestamps
- [ ] Export as Markdown, JSON, Plain Text
- [ ] Verify file naming convention
- [ ] Check Markdown frontmatter

**Resizable Sidebar**:
- [ ] Drag resize handle smoothly
- [ ] Verify 320px minimum / 800px maximum
- [ ] Check responsive breakpoints (450px)
- [ ] Verify width persists after reload

---

## Summary & Next Steps

### Current Status
- ✅ **60-70% Complete**: Core features working (auto-save, management, basic export, floating indicator)
- ⏳ **In Progress**: Platform adapters (Manus, Genspark)
- ❌ **Missing**: Fuzzy search, export wizard, resizable sidebar

### Priority Order
1. **Week 1-2**: Add Manus & Genspark adapters (current priority)
2. **Week 3-4**: Implement fuzzy search with highlighting
3. **Week 5-6**: Build export wizard with time filters
4. **Week 7-8**: Add resizable sidebar

### Total Effort
**6-8 weeks** to reach "Chat Memo Pro" feature parity with specs

### Technical Approach
- ✅ Keep Vanilla JavaScript architecture (no React migration)
- ✅ Incremental enhancements (low risk, faster delivery)
- ✅ Maintain existing 9,442 lines of working code
- ✅ Add features as standalone modules

---

**End of Document**
