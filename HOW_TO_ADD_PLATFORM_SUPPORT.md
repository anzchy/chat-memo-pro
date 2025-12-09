# 如何补充和改进平台适配器的对话识别

本文档详细说明如何为 Manus、Genspark 或其他 AI 聊天平台补充和改进对话识别代码。

---

## 📋 目录

1. [识别方法概述](#识别方法概述)
2. [开发者工具分析](#开发者工具分析)
3. [适配器文件位置](#适配器文件位置)
4. [识别策略](#识别策略)
5. [代码实现位置](#代码实现位置)
6. [完整代码参考](#完整代码参考)
7. [测试和调试](#测试和调试)
8. [最佳实践](#最佳实践)

---

## 识别方法概述

### 三种主要识别策略

1. **基于 DOM 选择器**（推荐）
   - 适用于有明确 CSS 类名或 data 属性的平台
   - 示例：ChatGPT、Claude、Gemini

2. **基于启发式文本分析**
   - 适用于 DOM 结构不稳定的平台
   - 示例：Manus（当前实现）

3. **混合策略**
   - 结合选择器和文本分析
   - 示例：Genspark（当前实现）

---

## 开发者工具分析

### 步骤 1: 打开开发者工具

1. 访问目标 AI 平台（如 Manus.im 或 Genspark.ai）
2. 按 `F12` 或 `Cmd+Option+I` (Mac) 打开 DevTools
3. 点击 "Elements" 标签

### 步骤 2: 定位消息元素

#### 方法 A: 使用元素选择器

1. 点击 DevTools 左上角的**元素选择器图标** (鼠标指针图标)
2. 将鼠标悬停在页面上的用户消息上，点击
3. 在 Elements 面板中查看高亮的 HTML 结构
4. 记录以下信息：
   ```
   - 父容器的类名或 ID
   - 消息气泡的类名
   - 用户消息和 AI 消息的区别特征
   - 消息内容所在的元素
   ```

#### 方法 B: 使用 Console 搜索

在 Console 中运行以下命令来快速查找元素：

```javascript
// 1. 查找所有可能的消息容器
document.querySelectorAll('[class*="message"]');
document.querySelectorAll('[class*="chat"]');
document.querySelectorAll('[class*="bubble"]');
document.querySelectorAll('[data-*]'); // 查找所有有 data 属性的元素

// 2. 查找特定文本（替换为实际消息内容）
Array.from(document.querySelectorAll('*')).find(el => el.textContent.includes('你的消息内容'));

// 3. 获取元素的所有类名
element.className

// 4. 获取元素的所有 data 属性
Array.from(element.attributes).filter(attr => attr.name.startsWith('data-'));
```

### 步骤 3: 分析消息特征

记录以下关键信息：

```markdown
## 用户消息特征
- 选择器:
- 类名特征:
- data 属性:
- 父容器:
- 文本内容位置:

## AI 消息特征
- 选择器:
- 类名特征:
- data 属性:
- 父容器:
- 文本内容位置:

## 消息容器
- 共同父容器:
- 消息排列方式: (垂直列表 / 其他)
- 是否有唯一标识符: (message-id / data-id 等)
```

---

## 适配器文件位置

### 文件结构

```
chat-memo-pro/
├── js/
│   ├── adapters/
│   │   ├── chatgpt.js       ← ChatGPT 适配器（参考示例）
│   │   ├── claude.js        ← Claude 适配器（参考示例）
│   │   ├── gemini.js        ← Gemini 适配器（参考示例）
│   │   ├── manus.js         ← Manus 适配器（需要改进）
│   │   ├── genspark.js      ← Genspark 适配器（需要改进）
│   │   └── [new-platform].js ← 新平台适配器
│   └── core/
│       └── base.js          ← BasePlatformAdapter 基类
└── manifest.json            ← 需要注册新平台
```

### 修改哪些文件？

1. **修改现有适配器**：`js/adapters/manus.js` 或 `js/adapters/genspark.js`
2. **创建新适配器**：创建 `js/adapters/[platform].js`
3. **注册到 manifest.json**：添加 content_scripts 配置

---

## 识别策略

### 策略 1: 基于 DOM 选择器（推荐）

**适用场景**：页面有稳定的 CSS 类名或 data 属性

**实现位置**：`extractMessages()` 方法

**示例代码框架**：

```javascript
extractMessages() {
  const messages = [];

  // 1. 查找所有消息元素
  const messageElements = document.querySelectorAll('你的选择器');

  messageElements.forEach(element => {
    // 2. 判断角色
    let role = 'assistant'; // 默认为 AI
    if (element.classList.contains('user-message-class')) {
      role = 'user';
    }

    // 3. 提取内容
    const contentElement = element.querySelector('.content-class');
    const content = contentElement ? contentElement.innerText.trim() : '';

    // 4. 添加到消息数组
    if (content && content.length > 0) {
      messages.push({
        role: role,
        content: content,
        timestamp: Date.now()
      });
    }
  });

  return messages;
}
```

### 策略 2: 基于启发式文本分析

**适用场景**：DOM 结构不稳定，但文本模式可预测

**实现位置**：`extractMessages()` + 辅助方法

**示例代码框架**：

```javascript
// 辅助方法：判断文本是否像用户消息
looksLikeUserMessage(text) {
  const userPatterns = [
    '如何', '怎么', '写一个', '帮我', '能否', '请',
    'how', 'write', 'help me', 'can you', 'please'
  ];

  // 长度适中
  if (text.length > 500) return false;

  // 包含问题或请求关键词
  return userPatterns.some(pattern =>
    text.toLowerCase().includes(pattern.toLowerCase())
  );
}

// 主提取方法
extractMessages() {
  const bodyText = document.body.innerText;
  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const messages = [];
  // ... 遍历 lines，应用启发式规则
  return messages;
}
```

### 策略 3: 混合策略

**适用场景**：结合选择器和文本分析，提高准确率

**实现位置**：`extractMessages()` 方法

**示例代码框架**：

```javascript
extractMessages() {
  const messages = [];

  // 1. 首先尝试 DOM 选择器
  const messageElements = document.querySelectorAll('.message-bubble');

  if (messageElements.length > 0) {
    // 使用 DOM 选择器方法
    messageElements.forEach(element => {
      // ... DOM 提取逻辑
    });
  } else {
    // 2. 回退到启发式方法
    const userMessage = this.findUserMessage();
    const aiResponse = this.extractAIResponse();
    // ... 添加到 messages
  }

  return messages;
}
```

---

## 代码实现位置

### 必须实现的方法

每个适配器都需要实现以下方法：

| 方法名 | 说明 | 示例返回值 |
|--------|------|------------|
| `isValidConversationUrl(url)` | 判断 URL 是否为有效对话页面 | `true` / `false` |
| `extractConversationInfo(url)` | 从 URL 提取对话 ID | `{ conversationId: 'xxx', isNewConversation: false }` |
| `extractMessages()` | **核心方法**：提取页面上的所有消息 | `[{ role: 'user', content: '...', timestamp: 123 }]` |
| `extractTitle()` | 提取对话标题 | `"对话标题"` |
| `isMessageElement(element)` | 判断元素是否为消息元素 | `true` / `false` |

---

## 完整代码参考

### 1. Manus 适配器 - 当前实现

**文件位置**：`js/adapters/manus.js`

<details>
<summary><strong>点击展开：Manus 消息识别代码</strong></summary>

```javascript
/**
 * 提取页面上的所有消息
 * @returns {Array} - 消息数组
 */
extractMessages() {
  const messages = [];

  // 策略 1: 查找所有带 data-event-id 的消息行
  const allMessageRows = document.querySelectorAll('div[data-event-id]');

  if (allMessageRows.length === 0) {
    // 策略 2: 回退到启发式方法
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

  // 使用 DOM 选择器提取
  allMessageRows.forEach(row => {
    let role = 'assistant';
    let content = '';

    // 判定角色：检查类名
    if (row.classList.contains('items-end') && row.classList.contains('justify-end')) {
      role = 'user';
    }

    // 提取内容
    if (role === 'user') {
      const contentEl = row.querySelector('.whitespace-pre-wrap');
      if (contentEl) {
        content = contentEl.innerText.trim();
      }
    } else {
      // AI 消息
      const contentEl = row.querySelector('.markdown-body') || row;
      content = contentEl.innerText.trim();
    }

    // 清理消息内容（移除时间戳等）
    content = this.cleanMessageContent(content);

    if (content && content.length > 0 && !this.isUIElement(content)) {
      // 合并连续的 AI 消息
      if (role === 'assistant' && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        messages[messages.length - 1].content += '\n\n' + content;
      } else {
        messages.push({
          role: role,
          content: content,
          timestamp: Date.now()
        });
      }
    }
  });

  return messages;
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
 * 过滤 UI 元素和元数据
 * @param {string} text - 要检查的文本
 * @returns {boolean} - 是否为 UI 元素或应该过滤的内容
 */
isUIElement(text) {
  const uiPatterns = [
    'New task', 'Search', 'Library', 'Projects',
    'Share Manus', 'Manus 1.5', '优化指令', 'Settings'
  ];

  // 过滤 UI 元素
  if (uiPatterns.some(pattern => text.includes(pattern))) {
    return true;
  }

  // 过滤纯时间戳（如 "00:12"）
  if (/^\d{1,2}:\d{2}$/.test(text.trim())) {
    return true;
  }

  // 过滤太短的文本
  if (text.trim().length < 3) {
    return true;
  }

  return false;
}
```

</details>

---

### 2. Genspark 适配器 - 当前实现

**文件位置**：`js/adapters/genspark.js`

<details>
<summary><strong>点击展开：Genspark 消息识别代码</strong></summary>

```javascript
/**
 * 判断元素是否为消息元素
 * @param {HTMLElement} element - 要检查的 DOM 元素
 * @returns {boolean} - 是否为消息元素
 */
isMessageElement(element) {
  if (!element || !element.matches) {
    return false;
  }

  // Genspark 的消息元素是 div.bubble[message-content-id]
  return element.matches('div.bubble[message-content-id]');
}

/**
 * 提取页面上的所有消息
 * @returns {Array} - 消息数组
 */
extractMessages() {
  const messages = [];

  // 查找所有消息气泡元素
  const messageBubbles = document.querySelectorAll('div.bubble[message-content-id]');

  if (messageBubbles.length === 0) {
    console.log('Keep AI Memory (Genspark): 未找到任何消息气泡元素');
    return messages;
  }

  messageBubbles.forEach(bubble => {
    let role = 'assistant';
    let content = '';

    // 判定角色：检查父容器类名
    const userDescParent = bubble.closest('.conversation-item-desc.user');

    if (userDescParent) {
      role = 'user';
    } else {
      // 启发式判断：用户消息通常有 <pre><code>，AI 消息有 markdown-viewer
      const preCodeElement = bubble.querySelector('.content pre code');
      const markdownViewerElement = bubble.querySelector('.content .markdown-viewer');

      if (preCodeElement && !markdownViewerElement) {
        role = 'user';
      } else {
        role = 'assistant';
      }
    }

    // 提取内容
    if (role === 'user') {
      const codeElement = bubble.querySelector('.content pre code');
      if (codeElement) {
        content = codeElement.innerText.trim();
      } else {
        const contentDiv = bubble.querySelector('.content');
        if (contentDiv) {
          content = contentDiv.innerText.trim();
        }
      }
    } else {
      // AI 消息
      const markdownViewer = bubble.querySelector('.content .markdown-viewer');
      if (markdownViewer) {
        content = markdownViewer.innerText.trim();
      } else {
        const contentDiv = bubble.querySelector('.content');
        if (contentDiv) {
          content = contentDiv.innerText.trim();
        }
      }
    }

    if (content && content.length > 0 && !this.isUIElement(content)) {
      // 合并连续的 AI 消息
      if (role === 'assistant' && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        messages[messages.length - 1].content += '\n\n' + content;
      } else {
        messages.push({
          role: role,
          content: content,
          timestamp: Date.now()
        });
      }
    }
  });

  console.log(`Keep AI Memory (Genspark): 提取到 ${messages.length} 条消息`);
  return messages;
}

/**
 * 过滤 UI 元素
 * @param {string} text - 要检查的文本
 * @returns {boolean} - 是否为 UI 元素
 */
isUIElement(text) {
  const uiPatterns = [
    'Copy', 'Deep Research', 'Save to Notion'
  ];
  return uiPatterns.some(pattern => text === pattern || text.includes(pattern + ' '));
}
```

</details>

---

### 3. ChatGPT 适配器 - 参考示例

**文件位置**：`js/adapters/chatgpt.js`

<details>
<summary><strong>点击展开：ChatGPT 消息识别代码（基于 DOM 选择器）</strong></summary>

```javascript
/**
 * 判断元素是否为消息元素
 */
isMessageElement(element) {
  if (!element || !element.matches) {
    return false;
  }
  // ChatGPT 的消息元素通常有 data-message-author-role 属性
  return element.hasAttribute('data-message-author-role');
}

/**
 * 提取页面上的所有消息
 */
extractMessages() {
  const messages = [];

  // ChatGPT 的消息元素选择器
  const messageElements = document.querySelectorAll('[data-message-author-role]');

  messageElements.forEach(element => {
    // 获取角色
    const role = element.getAttribute('data-message-author-role');

    // 提取内容
    const contentElement = element.querySelector('.markdown, .whitespace-pre-wrap');
    const content = contentElement ? contentElement.innerText.trim() : '';

    if (content && content.length > 0) {
      messages.push({
        role: role,
        content: content,
        timestamp: Date.now()
      });
    }
  });

  return messages;
}
```

</details>

---

### 4. Claude 适配器 - 参考示例

**文件位置**：`js/adapters/claude.js`

<details>
<summary><strong>点击展开：Claude 消息识别代码</strong></summary>

```javascript
/**
 * 提取页面上的所有消息
 */
extractMessages() {
  const messages = [];

  // Claude 使用特定的 DOM 结构
  const messageContainers = document.querySelectorAll('div[class*="font-claude-message"]');

  messageContainers.forEach(container => {
    // 判断角色
    let role = 'assistant';
    const userIndicator = container.querySelector('[class*="user"]');
    if (userIndicator) {
      role = 'user';
    }

    // 提取内容
    const contentElement = container.querySelector('div.font-user-message, div.font-claude-message');
    const content = contentElement ? contentElement.innerText.trim() : '';

    if (content && content.length > 0) {
      messages.push({
        role: role,
        content: content,
        timestamp: Date.now()
      });
    }
  });

  return messages;
}
```

</details>

---

## 测试和调试

### 方法 1: 使用内置调试器

在对话页面的 Console 中运行：

```javascript
// 1. 加载调试器（复制 README.md 中的完整脚本）
(function() {
  // ... 调试器代码 ...
})();

// 2. 测试消息提取
cmDebug.getMessages();

// 3. 查看提取的标题
cmDebug.getTitle();

// 4. 查看适配器状态
cmDebug.status();

// 5. 强制保存
cmDebug.forceSave();
```

### 方法 2: 直接测试提取方法

```javascript
// 直接访问适配器实例
const adapter = window.AdapterInstance;

// 测试消息提取
const messages = adapter.extractMessages();
console.log('提取到的消息:', messages);

// 测试标题提取
const title = adapter.extractTitle();
console.log('提取的标题:', title);

// 测试 URL 验证
console.log('URL 是否有效:', adapter.isValidConversationUrl(window.location.href));

// 测试对话 ID 提取
console.log('对话信息:', adapter.extractConversationInfo(window.location.href));
```

### 方法 3: 添加日志输出

在适配器代码中添加详细日志：

```javascript
extractMessages() {
  console.log('开始提取消息...');

  const messageElements = document.querySelectorAll('你的选择器');
  console.log(`找到 ${messageElements.length} 个消息元素`);

  messageElements.forEach((element, index) => {
    console.log(`处理第 ${index + 1} 个消息元素:`, element);
    // ... 提取逻辑
  });

  console.log(`最终提取到 ${messages.length} 条消息`);
  return messages;
}
```

---

## 最佳实践

### 1. 选择器优先级

按照以下优先级选择元素：

```javascript
// ✅ 最佳：使用 data 属性（最稳定）
document.querySelectorAll('[data-message-id]');
document.querySelectorAll('[data-role="user"]');

// ✅ 良好：使用唯一的类名
document.querySelectorAll('.message-bubble');
document.querySelectorAll('.user-message');

// ⚠️ 谨慎：使用常见类名（可能不稳定）
document.querySelectorAll('.text-base');
document.querySelectorAll('.flex');

// ❌ 避免：使用标签名（太通用）
document.querySelectorAll('div');
document.querySelectorAll('p');
```

### 2. 内容清理

始终清理提取的内容：

```javascript
cleanMessageContent(content) {
  if (!content) return '';

  // 1. 移除时间戳
  content = content.replace(/^\d{1,2}:\d{2}\s+/, '');

  // 2. 移除多余空白
  content = content.replace(/\s+/g, ' ').trim();

  // 3. 移除特定 UI 文本
  const uiPatterns = ['Copy', 'Edit', 'Regenerate'];
  uiPatterns.forEach(pattern => {
    content = content.replace(new RegExp(`^${pattern}\\s+`, 'i'), '');
  });

  return content;
}
```

### 3. 回退机制

实现多层回退策略：

```javascript
extractMessages() {
  // 第 1 层：尝试最精确的选择器
  let messages = this.tryMethod1();
  if (messages.length > 0) return messages;

  // 第 2 层：尝试备用选择器
  messages = this.tryMethod2();
  if (messages.length > 0) return messages;

  // 第 3 层：回退到启发式方法
  return this.tryHeuristicMethod();
}
```

### 4. 消息合并

正确处理连续的 AI 消息：

```javascript
if (content && content.length > 0 && !this.isUIElement(content)) {
  // 合并连续的 AI 消息
  if (role === 'assistant' && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
    messages[messages.length - 1].content += '\n\n' + content;
  } else {
    messages.push({
      role: role,
      content: content,
      timestamp: Date.now()
    });
  }
}
```

### 5. UI 元素过滤

建立完整的 UI 元素过滤列表：

```javascript
isUIElement(text) {
  const uiPatterns = [
    // 按钮文本
    'Copy', 'Edit', 'Regenerate', 'Delete', 'Share',
    // 时间戳
    /^\d{1,2}:\d{2}$/,
    // 状态文本
    'Typing...', 'Generating...', 'Loading...',
    // 其他 UI
    'New chat', 'Settings', 'Profile'
  ];

  return uiPatterns.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(text.trim());
    }
    return text.includes(pattern);
  });
}
```

---

## 改进建议速查表

| 平台 | 当前问题 | 建议改进 | 优先级 |
|------|---------|---------|--------|
| **Manus** | 部分对话捕捉不完整 | 1. 增加更多 data 属性选择器<br>2. 改进启发式规则<br>3. 添加更多日志调试 | 🔴 高 |
| **Genspark** | 识别不稳定 | 1. 补充备用选择器<br>2. 增加父容器查找<br>3. 改进角色判断逻辑 | 🔴 高 |

---

## 快速开始模板

复制此模板开始改进适配器：

```javascript
/**
 * 改进消息提取 - 模板
 */
extractMessages() {
  const messages = [];

  // ========== 策略 1: 主要选择器 ==========
  const primarySelector = 'YOUR_PRIMARY_SELECTOR_HERE';
  const elements = document.querySelectorAll(primarySelector);

  if (elements.length > 0) {
    elements.forEach(element => {
      // 判断角色
      const role = this.determineRole(element);

      // 提取内容
      const content = this.extractContent(element, role);

      // 清理和验证
      const cleanContent = this.cleanMessageContent(content);

      if (cleanContent && !this.isUIElement(cleanContent)) {
        this.addMessage(messages, role, cleanContent);
      }
    });

    return messages;
  }

  // ========== 策略 2: 备用选择器 ==========
  const fallbackSelector = 'YOUR_FALLBACK_SELECTOR_HERE';
  const fallbackElements = document.querySelectorAll(fallbackSelector);

  if (fallbackElements.length > 0) {
    // ... 类似的提取逻辑
  }

  // ========== 策略 3: 启发式方法 ==========
  return this.extractWithHeuristics();
}

/**
 * 辅助方法：判断角色
 */
determineRole(element) {
  // 添加你的角色判断逻辑
  if (element.classList.contains('user-class')) {
    return 'user';
  }
  return 'assistant';
}

/**
 * 辅助方法：提取内容
 */
extractContent(element, role) {
  // 添加你的内容提取逻辑
  const contentEl = element.querySelector('.content-class');
  return contentEl ? contentEl.innerText.trim() : '';
}

/**
 * 辅助方法：添加消息（处理合并）
 */
addMessage(messages, role, content) {
  if (role === 'assistant' && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
    messages[messages.length - 1].content += '\n\n' + content;
  } else {
    messages.push({
      role: role,
      content: content,
      timestamp: Date.now()
    });
  }
}
```

---

## 常见问题排查

### Q1: 提取的消息为空

**检查清单**：
- [ ] 选择器是否正确？在 Console 运行 `document.querySelectorAll('你的选择器')` 验证
- [ ] 页面是否完全加载？尝试延迟提取
- [ ] 内容是否在 iframe 中？检查 iframe 结构
- [ ] 是否被 `isUIElement()` 误过滤？添加日志调试

### Q2: 角色判断错误（用户/AI 混淆）

**检查清单**：
- [ ] 检查类名特征是否正确
- [ ] 使用开发者工具确认角色标识符
- [ ] 添加日志输出角色判断过程
- [ ] 考虑添加更多判断条件

### Q3: 重复消息

**检查清单**：
- [ ] 检查是否有多个选择器匹配同一元素
- [ ] 验证消息合并逻辑
- [ ] 检查 `cleanMessageContent()` 是否正确去重
- [ ] 添加消息去重逻辑

### Q4: 时间戳或 UI 元素未被过滤

**解决方案**：
```javascript
isUIElement(text) {
  // 添加更多过滤模式
  const uiPatterns = [
    // ... 现有模式
    /^\d{1,2}:\d{2}$/,          // 时间戳
    /^(Copy|Edit|Delete)$/i,    // 按钮
    /^(Typing|Loading)\.{3}$/i  // 状态
  ];

  return uiPatterns.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(text.trim());
    }
    return text.includes(pattern);
  });
}
```

---

## 下一步

1. **分析目标平台**：使用开发者工具收集选择器信息
2. **修改适配器代码**：在对应的 `js/adapters/[platform].js` 文件中改进 `extractMessages()` 方法
3. **测试验证**：使用调试器验证提取结果
4. **提交改进**：将改进后的代码提交到代码库

---

## 参考资源

- [Chrome DevTools 文档](https://developer.chrome.com/docs/devtools/)
- [querySelector 参考](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector)
- [正则表达式参考](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)

---

**最后更新**：2025-12-09
**维护者**：Eze & Jack
