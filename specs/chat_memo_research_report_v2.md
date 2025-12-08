# AI 对话记录保存工具 - 深度需求调研报告 v2.0

> 基于 Chat Memo 的完整分析与产品设计方案

---

## 📋 执行摘要

### 项目背景
随着 AI 成为日常工作工具，用户每天产生大量与 AI 的对话记录。这些对话包含着思考过程、情绪流动、解决方案探索等宝贵的个人智慧资产。然而，这些数据目前：
- **分散存储**在不同平台（ChatGPT、Gemini、Claude 等）
- **易于丢失**（部分平台会丢失记录）
- **难以检索**（缺乏统一搜索）
- **无法迁移**（平台间隔离）

### 项目目标
开发一款 Chrome 扩展，实现：
1. **自动保存** Gemini Pro、Claude、ChatGPT、Manus、Genspark.ai 五大平台的对话
2. **统一管理**所有 AI 对话记录
3. **智能检索**历史对话内容
4. **本地优先**，保护用户隐私
5. **无感同步**，不干扰正常使用

### 核心价值主张
> "你的下一个想法，源于所有过去的想法"

AI 对话记录不仅是信息的堆砌，更是：
- 思维连续性的载体
- 情绪流动的记录
- 自我认知的镜子
- 构建"懂你的 AI"的基础数据

---

## 🎯 Chat Memo 产品深度分析

### 1. 产品概况

#### 1.1 基本信息
- **产品名称**：Chat Memo
- **官网**：https://chatmemo.ai/
- **类型**：Chrome 浏览器扩展
- **商店评分**：4.9/5.0（Google 精选扩展）
- **用户规模**：6000+ 用户（截至 2025.07，无主动推广）
- **开发者**：一泽 Eze（AI 博主、提示词工程师）

#### 1.2 产品定位
"AI 记忆中枢" —— 将零散的 AI 对话聚合为统一、私密、可检索的个人智慧资产

#### 1.3 核心口号
- **Slogan**：别让灵感，随聊天窗口一同关闭
- **使命**：让每个 AI 对话都能被保存
- **愿景**：帮助每个人打造"AI 记忆中枢"

### 2. 已实现的核心功能

#### 2.1 自动保存功能 ⭐⭐⭐⭐⭐

**功能描述**：
- 在用户与 AI 对话时，后台静默工作，自动实时保存
- 无需手动点击导出或保存
- 自动捕获每次对话的新增内容

**技术亮点**：
- **实时增量同步**：每发送一条消息，立即保存
- **版本控制**：自动同步重新编辑、重新生成的消息
- **思考过程保存**：连 AI 的 thinking 过程都能记录
- **智能去重**：只保存真实变化的内容

**支持平台**（已验证）：
- ✅ ChatGPT（chat.openai.com）
- ✅ Google Gemini（gemini.google.com）
- ✅ Claude（claude.ai）
- ✅ DeepSeek（chat.deepseek.com）
- ✅ 腾讯元宝（yuanbao.tencent.com）
- ✅ 豆包（doubao.com）
- ✅ Kimi（kimi.moonshot.cn）

**技术实现**：
```javascript
// 使用 MutationObserver 监听 DOM 变化
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      // 检测新消息
      const newMessages = extractMessages(mutation.addedNodes);
      if (newMessages.length > 0) {
        // 发送到 background 保存
        chrome.runtime.sendMessage({
          action: 'saveMessages',
          data: newMessages
        });
      }
    }
  });
});
```

#### 2.2 统一管理界面 ⭐⭐⭐⭐⭐

**界面组成**（从截图可见）：
```
┌─────────────────────────────────────┐
│  Chat Memo 侧边栏                    │
├─────────────────────────────────────┤
│  📊 数据统计                         │
│  • Total Conversations: 51          │
│  • Today's New: 5                   │
├─────────────────────────────────────┤
│  🔍 搜索框                           │
│  Search titles and content...  🔽   │
├─────────────────────────────────────┤
│  📝 对话列表                         │
│  ┌───────────────────────────────┐ │
│  │ lighthouse@VM-16-7-ubuntu...  │ │
│  │ 在 lighthouse@VM-16-7-ubuntu  │ │
│  │ 这种 Linux 服务器环境下...     │ │
│  │ 💬 Gemini  2  57 minutes ago  │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 安装 OpenAI Codex cli 的命令  │ │
│  │ 你这一步其实已经把 uv 装好了  │ │
│  │ 💬 ChatGPT  4  11 hours ago   │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**设计特点**：
1. **极简设计**：所有功能在 1-2 个页面完成
2. **信息层次清晰**：
   - 顶部：数据统计卡片
   - 中部：搜索和筛选
   - 下部：对话列表滚动区
3. **平台标识明显**：每条对话显示来源（Gemini、ChatGPT 等）
4. **时间信息完整**：相对时间 + 消息数量

#### 2.3 智能搜索功能 ⭐⭐⭐⭐

**搜索能力**：
- **全文搜索**：搜索所有对话内容
- **标题搜索**：搜索对话标题
- **深度搜索**：包括 AI 思考过程（thinking）
- **高亮显示**：匹配关键词高亮标注
- **筛选功能**：按平台、时间范围筛选

**搜索场景示例**（来自直播）：
```
用户搜索："枯萎技术"
→ 系统返回：关于任天堂枯萎技术的讨论
→ 点击后：高亮显示所有"枯萎"关键词
→ 操作：可直接跳转到原对话继续聊
```

**技术方案**：
```javascript
// 简单搜索实现
function searchConversations(keyword) {
  return conversations.filter(conv => {
    // 搜索标题
    if (conv.title.includes(keyword)) return true;
    
    // 搜索消息内容
    return conv.messages.some(msg => 
      msg.content.toLowerCase().includes(keyword.toLowerCase())
    );
  });
}

// 高级搜索（使用 Fuse.js）
const fuse = new Fuse(conversations, {
  keys: ['title', 'messages.content', 'messages.thinking'],
  threshold: 0.3,
  includeScore: true
});
```

#### 2.4 本地隐私保护 ⭐⭐⭐⭐⭐

**隐私承诺**：
- ✅ 100% 本地存储（浏览器 Storage API）
- ✅ 不与外部服务器通信
- ✅ 不收集任何用户数据
- ✅ 用户拥有绝对控制权
- ✅ 可随时删除所有数据

**技术实现**：
```javascript
// 数据保存到本地
async function saveToLocal(conversation) {
  const key = `conv_${conversation.id}`;
  await chrome.storage.local.set({
    [key]: conversation
  });
}

// 数据完全在本地，不发送到云端
// Chat Memo 当前版本无服务器成本
```

**创始人原话**（来自直播）：
> "China memo 这款产品，它现在是一款运行在谷歌浏览器上的一个本地插件。整个过程中，china memo 他不会跟网络上的其他资源进行沟通。所有数据都是保存在你自己的电脑上面，是非常安全的。"

#### 2.5 数据导出功能 ⭐⭐⭐⭐

**导出能力**：
- **一键导出**所有对话记录
- **选择性导出**特定平台或时间段的对话
- **格式支持**：结构化数据格式
- **导出用途**：
  - 备份到本地
  - 上传到 Notion
  - 导入到 Obsidian
  - 上传到 DeepNote 等知识库

**导出场景**（来自直播）：
1. **AI 互动周报**：导出上周对话 → 让 AI 生成周报
2. **主题复盘**：导出特定项目的所有对话 → 提炼洞察
3. **自我认知**：导出所有对话 → 分析思维模式

**开发者承诺**：
> "数据本来就是你的，我们 chat memo 无权或者说任何产品也无权去把这些数据通过导出等等这些行为进行收费。"

### 3. 功能亮点分析

#### 3.1 技术亮点

**① 市面上体验最流畅的同步**
- 经过"数十轮代码打磨"
- 实时同步，无卡顿
- 智能增量更新
- 准确捕获编辑后的消息

**② 唯一支持版本控制的产品**
```
用户场景：
1. 发送："请告诉我你有什么功能？"
2. AI 回答后，用户不满意
3. 用户修改为："请告诉我你最重要的功能"
4. Chat Memo 自动保存最新版本

竞品对比：
- 其他产品：只保存初始版本
- Chat Memo：保存最新修改
```

**③ 浮动状态栏设计**
- 显示同步状态（"正在同步... 3"）
- 可拖动贴边（自动吸附）
- 最小化干扰
- 提供即时反馈

#### 3.2 用户体验亮点

**① 零学习成本**
- 安装即用，无需配置
- 自动运行，无需记忆操作
- 界面直观，符合直觉

**② 跨平台无缝续聊**
```
典型场景：
1. 在 ChatGPT 聊到一半
2. 免费次数用完了
3. 复制对话记录
4. 粘贴到 DeepSeek 继续聊
5. Chat Memo 继续保存新对话
```

**③ 提供官方提示词配方**
官网提供三个核心玩法：
1. **AI 互动周报**：分析上周对话主题和洞察
2. **主题洞察**：提炼特定主题的核心观点
3. **自我探索**：分析个人思维模式和性格特质

#### 3.3 价值亮点

**① 保留思维连续性**
不仅保存结果，更保存过程：
- 犹豫不决的反复
- "你懂我"的 Aha Moment
- 情绪的起伏变化
- 思考的演进路径

**② 实现自我认知**
真实案例（来自创始人分享）：
```
场景：用户让 AI 分析自己的 MBTI
结果：用户忘记上传聊天记录
惊喜：AI 仅凭一段提示词的风格，就准确推测出 INTJ

说明：AI 对话中隐藏着我们未曾察觉的性格线索
```

**③ 构建"懂你的 AI"基础**
创始人的产品哲学：
> "要让 AI 懂自己，前提是要有 context。所以我选择先帮用户解决 context 的问题。"

Chat Memo 不是终点，而是通向 **AI Partner** 的第一步。

### 4. 产品设计哲学（重要）

#### 4.1 开发背景故事

**开发者背景**：
- 工业设计专业出身
- 产品经理，非计算机背景
- AI 博主（公众号：一泽 Eze）
- 提示词工程师

**开发方式**：
- **100% 使用 AI Coding 开发**
- 工具：字节 Cursor → Claude Code & Cursor
- 角色：代码审计 + 测试
- AI 负责：架构、编码、UI 设计、Bug 修复

**开发时间线**：
```
Week 1:
- Day 1-4: 需求思考和定义
- Day 5-10: 主体功能开发（每天工作 18 小时）

Week 2:
- Day 11-14: 官网设计 + 宣传定调
- Day 14: 正式发布

总计：14 天（2 周）
```

**开发成本**：
- 人力：1 人
- 资金：几乎为零（无服务器成本）
- 时间：2 周

这个案例充分说明：**AI Coding 降低了产品开发门槛**

#### 4.2 产品设计原则

**原则 1：加功能容易，删功能困难**
> "很多产品加了非常多的 AI 功能，使用率不足 1%。但能删吗？不能删。因为已经有用户开始用了。"

**启示**：
- 谨慎添加新功能
- 优先打磨核心功能
- 避免注意力分散

**原则 2：单点功能打透**
> "如果核心功能没做全，直接做下一个事情，对于 Kimi 的用户、千问的用户来讲，他们还是没办法使用我的产品。"

**当前策略**：
1. 先支持所有主流 AI 平台
2. 再考虑云同步
3. 最后引入 AI 问答功能

**原则 3：流水视角做产品**
> "在 AI 行业里面的外部变化非常快。我更倾向于流水的视角去做产品，定义好未来 90-180 天内的事情。"

**启示**：
- 不过度规划长期路线
- 关注当前最适合用户的功能
- 灵活应对行业变化

#### 4.3 为什么 Chat Memo 会成功？

**成功要素分析**：

1. **真实需求驱动**
   - 创始人自己就是重度用户
   - "我自己要用，所以才做 Chat Memo"
   - 第一性原理：解决自己的问题

2. **极致的执行力**
   - 2 周从 0 到 1
   - AI Coding 大幅提升效率
   - "AI Coding 一开始就上头，不停抽卡改代码"

3. **精准的产品定位**
   - 不做大而全
   - 专注"保存对话"这一核心功能
   - 留给未来想象空间

4. **优秀的用户体验**
   - 零学习成本
   - 无感同步
   - 界面简洁高效

5. **正确的商业模式**
   - 核心功能永久免费
   - 增值服务（云同步、AI 能力）按需付费
   - 不绑架用户数据

### 5. 竞品对比

#### 5.1 与 Cherry Studio 对比

**Cherry Studio**：
- 客户端形式
- 集成多个 AI 模型的 API
- 支持本地对话管理

**优势**：
- 如果所有对话都在 Cherry Studio 完成，天然统一管理
- 支持更多自定义配置

**劣势**：
- 需要用户主动配置 API
- 无法捕获官方平台的对话（如 ChatGPT Web）
- 缺少官方平台的新功能（如 Deep Research、Agent 等）

**Chat Memo 的差异化**：
- 捕获官方平台的原生对话
- 无需配置 API
- 支持官方平台的所有功能

#### 5.2 与 Notion/Flomo 对比

**Notion/Flomo**：
- 笔记工具
- 需要用户主动记录
- 适合记录思考结果

**Chat Memo 的差异化**：
- 自动记录，无需主动操作
- 保存对话过程，不只是结果
- 专注 AI 对话场景

**创始人原话**：
> "Notion、Chat Memo 和 Flomo 各自有各自擅长的领域。Flomo 更适合记录个人思考和阅读卡片，Notion 适合知识库，而 Chat Memo 专注自动保存 AI 对话。"

#### 5.3 与 Second.Me 对比

**Second.Me**：
- 唐方柏博士团队开发
- 通过后训练（Fine-tuning）方式
- 将个人记忆训练到模型中

**技术路线对比**：
```
Second.Me: 后训练 → 记忆融入模型权重
Chat Memo: RAG + Context → 记忆以数据形式存在

优缺点：
- 后训练：长期记忆更稳定，但成本高、灵活性低
- RAG：灵活、成本低，但可能有检索准确性问题
```

**Chat Memo 的定位**：
- 提供记忆存储的基础设施
- 未来可与其他 AI Partner 产品集成

### 6. 用户反馈与数据

#### 6.1 用户增长数据

**增长曲线**：
- 首周：2000+ 用户（自然增长，无推广）
- 当前：6000+ 用户
- Chrome Web Store 评分：4.9/5.0

**用户特征**：
- AI 时代的新工作者
- 重度 AI 使用者
- 知识工作者、创作者

#### 6.2 典型用户反馈

**好评**：
```
"提个小建议，能不能把这个 logo 弄得小一点，有时候会挡着。"
→ 开发者回应：最新版本支持拖动贴边，自动最小化
```

**需求**：
```
"我平时有四个设备使用 AI 对话的场景。我不仅想实现本地同步，还想实现云同步。"
→ 开发者回应：云同步功能正在开发中
```

**痛点**：
```
"为什么我需要 Chat Memo？我已经在用 Flomo 和 Notion 了。"
→ 说明：需要更好地传达产品价值
```

#### 6.3 用户使用场景（真实案例）

**场景 1：跨 AI 续聊**
```
步骤：
1. ChatGPT 免费次数用完
2. 从 Chat Memo 复制对话记录
3. 粘贴到 DeepSeek 继续讨论
4. 因为 DeepSeek 更擅长哲学思考
5. Chat Memo 继续记录新对话
```

**场景 2：AI 互动周报**
```
步骤：
1. 每周一，导出上周对话
2. 使用官网提供的提示词
3. 让 AI 分析对话主题
4. 生成个人成长周报

周报内容：
- 本周主要讨论的话题
- 关键洞察和突破
- 难题和挑战
- 下周思考方向
```

**场景 3：产品复盘**
```
步骤：
1. 筛选 Chat Memo 相关对话
2. 导出所有讨论记录
3. 让 AI 分析思维变化
4. 提炼产品设计决策

发现：
- 为什么选择这个产品名？
- 设计中的重要取舍
- 数据导出为何免费
```

**场景 4：自我认知**
```
步骤：
1. 导出所有对话记录
2. 使用"自我探索"提示词
3. 让 AI 分析提问风格
4. 了解个人思维模式

输出：
- 性格特质（如 INTJ）
- 思维偏好
- 核心关注点
- 内心张力
```

---

## 📝 目标产品需求定义

### 1. 核心目标

基于 Chat Memo 的成功经验，开发一款专注于**五大 AI 平台**的对话保存工具：
1. Gemini Pro
2. Claude  
3. ChatGPT
4. Manus
5. Genspark.ai

### 2. 差异化策略

#### 2.1 与 Chat Memo 的区别

**Chat Memo**：
- 支持 7-8 个平台
- 个人开发者
- 已有 6000 用户

**我们的产品**：
- 专注 5 大平台
- 可能采用不同技术栈（Python + JavaScript）
- 更注重特定平台的深度支持

#### 2.2 潜在优势

1. **技术栈优势**
   - 你擅长 Python 和 JavaScript
   - 可以快速迭代
   - 灵活的架构设计

2. **专注策略**
   - 5 个平台精细打磨
   - 更稳定的支持
   - 更快的更新响应

3. **创新空间**
   - 可以尝试不同的 UI 设计
   - 探索新的数据组织方式
   - 提供独特的使用场景

### 3. 功能需求列表

#### 3.1 MVP（最小可行产品）功能

**核心功能**（必须实现）：

**FR1: 自动保存对话**

- FR1.1 ✅ 自动检测 Gemini Pro 新消息
- FR1.2 ✅ 自动检测 Claude 新消息
- FR1.3 ✅ 自动检测 ChatGPT 新消息
- FR1.4 ✅ 自动检测 Manus 新消息
- FR1.5 ✅ 自动检测 Genspark.ai 新消息
- FR1.6 ✅ 实时增量保存
- FR1.7 ✅ 保存编辑后的消息

**FR2: 基础界面**
- FR2.1 ✅ 侧边栏展示对话列表
- FR2.2 ✅ 显示平台标识
- FR2.3 ✅ 显示时间和消息数
- FR2.4 ✅ 浮动状态栏

**FR3: 本地存储**
- FR3.1 ✅ 数据保存到本地
- FR3.2 ✅ 不上传到云端
- FR3.3 ✅ 用户可删除数据

**FR4: 基础搜索**
- FR4.1 ✅ 关键词搜索
- FR4.2 ✅ 按平台筛选

#### 3.2 V1.0 功能（首个正式版）

**增强功能**：

**FR5: 高级搜索**
- FR5.1 🔲 模糊搜索
- FR5.2 🔲 高亮显示
- FR5.3 🔲 按时间筛选
- FR5.4 🔲 搜索结果排序

**FR6: 对话管理**
- FR6.1 🔲 查看对话详情
- FR6.2 🔲 复制完整对话
- FR6.3 🔲 跳转到原平台
- FR6.4 🔲 删除单条对话

**FR7: 数据导出**
- FR7.1 🔲 导出所有对话
- FR7.2 🔲 导出选定对话
- FR7.3 🔲 JSON 格式导出
- FR7.4 🔲 Markdown 格式导出

#### 3.3 V2.0 功能（未来规划）

**高级功能**（参考 Chat Memo 路线图）：

**FR8: 云同步**
- FR8.1 🔲 多设备同步
- FR8.2 🔲 版本冲突处理
- FR8.3 🔲 加密传输

**FR9: AI 功能**
- FR9.1 🔲 AI 问答（基于历史对话）
- FR9.2 🔲 自动摘要
- FR9.3 🔲 主题分类
- FR9.4 🔲 智能标签

**FR10: 数据分析**
- FR10.1 🔲 使用统计
- FR10.2 🔲 对话可视化
- FR10.3 🔲 思维模式分析

### 4. 非功能需求

#### 4.1 性能需求
- **NFR1**：对话保存延迟 < 1秒
- **NFR2**：搜索响应时间 < 500ms
- **NFR3**：界面加载时间 < 2秒
- **NFR4**：内存占用 < 100MB

#### 4.2 可用性需求
- **NFR5**：安装即用，零配置
- **NFR6**：界面简洁直观
- **NFR7**：提供使用引导

#### 4.3 兼容性需求
- **NFR8**：Chrome 88+ 支持
- **NFR9**：Edge（Chromium）支持
- **NFR10**：适配各平台界面更新

#### 4.4 安全性需求
- **NFR11**：100% 本地存储
- **NFR12**：不收集用户数据
- **NFR13**：不与外部通信
- **NFR14**：用户可完全控制数据

---

## 🏗️ 技术架构设计

### 1. 技术栈选择

#### 1.1 核心技术

**必选技术**：
- **JavaScript/TypeScript**：扩展主要语言
- **Manifest V3**：Chrome 扩展最新规范
- **Chrome Extension APIs**：官方 API

**可选框架**：
- **React**：构建 UI（推荐）
- **Tailwind CSS**：样式框架
- **Vite**：构建工具

**工具库**：
- **Fuse.js**：模糊搜索
- **Day.js**：时间处理
- **localforage**：增强的 localStorage

#### 1.2 AI Coding 策略

借鉴 Chat Memo 的成功经验：
- 使用 **Claude Code** 或 **Cursor**
- AI 负责代码生成和 Bug 修复
- 开发者负责需求定义和代码审查

**预期效果**：
- 开发速度提升 3-5 倍
- 代码质量可控
- 快速迭代

### 2. 系统架构

#### 2.1 整体架构图

```
┌─────────────────────────────────────────────────┐
│                  Chrome 浏览器                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ AI 平台页面  │  │  侧边栏 UI   │            │
│  │ (Gemini etc) │  │  (React)     │            │
│  └──────┬───────┘  └───────┬──────┘            │
│         │                   │                    │
│         ├───── Content ─────┤                    │
│         │      Script       │                    │
│         │                   │                    │
│         │   ┌───────────────▼──────┐            │
│         │   │  Background Service  │            │
│         │   │      Worker          │            │
│         │   └───────────┬──────────┘            │
│         │               │                        │
│         │   ┌───────────▼──────────┐            │
│         └───│   Chrome Storage API │            │
│             │   (Local Storage)    │            │
│             └──────────────────────┘            │
└─────────────────────────────────────────────────┘
```

#### 2.2 数据流设计

```
用户在 AI 平台输入消息
    ↓
Content Script 监听 DOM 变化
    ↓
提取消息内容（用户消息 + AI 回复）
    ↓
通过 chrome.runtime.sendMessage 发送
    ↓
Background Service Worker 接收
    ↓
数据验证和处理
    ↓
保存到 Chrome Storage Local
    ↓
通知侧边栏 UI 更新
    ↓
用户在侧边栏看到新对话
```

### 3. 平台适配方案

#### 3.1 Gemini Pro 适配

**目标 URL**：
- https://gemini.google.com/app/*

**DOM 结构分析**（需实际调研）：
```javascript
const geminiAdapter = {
  name: 'gemini',
  url: 'gemini.google.com',
  selectors: {
    // 需要实际分析确定
    container: '.conversation-container',
    userMessage: '[data-role="user"]',
    aiMessage: '[data-role="model"]',
    timestamp: '.message-time'
  },
  extractMessage: (element) => {
    return {
      role: element.getAttribute('data-role'),
      content: element.textContent.trim(),
      timestamp: Date.now()
    };
  }
};
```

#### 3.2 Claude 适配

**目标 URL**：
- https://claude.ai/chats/*

**关键特性**：
- 支持 Thinking 过程
- 支持 Artifacts
- 消息可以重新生成

**DOM 结构**：
```javascript
const claudeAdapter = {
  name: 'claude',
  url: 'claude.ai',
  selectors: {
    container: '[data-conversation-turn]',
    userMessage: '[data-role="user"]',
    aiMessage: '[data-role="assistant"]',
    thinking: '.thinking-indicator',
    artifact: '.artifact-container'
  },
  extractMessage: (element) => {
    const hasThinking = element.querySelector('.thinking-indicator');
    return {
      role: element.getAttribute('data-role'),
      content: element.textContent.trim(),
      thinking: hasThinking ? hasThinking.textContent : null,
      timestamp: Date.now()
    };
  }
};
```

#### 3.3 ChatGPT 适配

**目标 URL**：
- https://chat.openai.com/c/*
- https://chatgpt.com/*

**关键特性**：
- 消息支持 Markdown
- 支持代码块
- 支持图片

**DOM 结构**：
```javascript
const chatgptAdapter = {
  name: 'chatgpt',
  url: 'chat.openai.com',
  selectors: {
    container: '[data-testid="conversation-turn"]',
    message: '.markdown',
    role: 'data-message-author-role',
    codeBlock: 'pre code'
  },
  extractMessage: (element) => {
    const role = element.getAttribute('data-message-author-role');
    const markdown = element.querySelector('.markdown');
    return {
      role: role,
      content: markdown ? markdown.textContent.trim() : '',
      timestamp: Date.now()
    };
  }
};
```

#### 3.4 Manus 适配

**状态**：需要调研
- 官网 URL: https://manus.im/
- DOM 结构待分析
- 特殊功能待了解

**TODO**：
```javascript
const manusAdapter = {
  name: 'manus',
  url: 'manus.app', // 待确认
  selectors: {
    // 待实际调研
  },
  extractMessage: (element) => {
    // 待实现
  }
};
```

#### 3.5 Genspark.ai 适配

**目标 URL**：
- https://www.genspark.ai/*

**状态**：需要调研
- DOM 结构待分析
- 平台特性待了解

**TODO**：
```javascript
const gensparkAdapter = {
  name: 'genspark',
  url: 'genspark.ai',
  selectors: {
    // 待实际调研
  },
  extractMessage: (element) => {
    // 待实现
  }
};
```

### 4. 核心模块实现

#### 4.1 消息监听器

```typescript
class ConversationMonitor {
  private observer: MutationObserver;
  private adapter: PlatformAdapter;
  
  constructor(adapter: PlatformAdapter) {
    this.adapter = adapter;
  }
  
  start() {
    const container = document.querySelector(
      this.adapter.selectors.container
    );
    
    if (!container) {
      console.error('Container not found');
      return;
    }
    
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });
    
    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  
  private handleMutations(mutations: MutationRecord[]) {
    const newMessages = this.extractNewMessages(mutations);
    
    if (newMessages.length > 0) {
      chrome.runtime.sendMessage({
        action: 'saveMessages',
        platform: this.adapter.name,
        messages: newMessages,
        timestamp: Date.now()
      });
    }
  }
  
  private extractNewMessages(mutations: MutationRecord[]) {
    // 提取新消息的逻辑
    const messages = [];
    
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const message = this.adapter.extractMessage(node as Element);
            if (message) {
              messages.push(message);
            }
          }
        });
      }
    });
    
    return messages;
  }
  
  stop() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
```

#### 4.2 数据存储管理

```typescript
interface Conversation {
  id: string;
  platform: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  url: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  timestamp: number;
}

class StorageManager {
  async saveConversation(conversation: Conversation) {
    const key = `conv_${conversation.platform}_${conversation.id}`;
    
    await chrome.storage.local.set({
      [key]: conversation
    });
    
    // 更新索引
    await this.updateIndex(conversation);
  }
  
  async getConversation(id: string): Promise<Conversation | null> {
    const result = await chrome.storage.local.get(`conv_${id}`);
    return result[`conv_${id}`] || null;
  }
  
  async getConversations(filters?: {
    platform?: string;
    dateRange?: [number, number];
    limit?: number;
  }): Promise<Conversation[]> {
    const allData = await chrome.storage.local.get(null);
    
    let conversations = Object.values(allData)
      .filter(item => (item as any).messages);
    
    // 应用筛选
    if (filters?.platform) {
      conversations = conversations.filter(
        c => (c as Conversation).platform === filters.platform
      );
    }
    
    if (filters?.dateRange) {
      const [start, end] = filters.dateRange;
      conversations = conversations.filter(c => {
        const conv = c as Conversation;
        return conv.createdAt >= start && conv.createdAt <= end;
      });
    }
    
    // 按时间排序
    conversations.sort((a, b) => 
      (b as Conversation).updatedAt - (a as Conversation).updatedAt
    );
    
    // 限制数量
    if (filters?.limit) {
      conversations = conversations.slice(0, filters.limit);
    }
    
    return conversations as Conversation[];
  }
  
  async searchConversations(keyword: string): Promise<Conversation[]> {
    const conversations = await this.getConversations();
    
    return conversations.filter(conv =>
      conv.title.toLowerCase().includes(keyword.toLowerCase()) ||
      conv.messages.some(msg =>
        msg.content.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  }
  
  async deleteConversation(id: string) {
    const key = `conv_${id}`;
    await chrome.storage.local.remove(key);
  }
  
  async exportAll(): Promise<Conversation[]> {
    return await this.getConversations();
  }
  
  private async updateIndex(conversation: Conversation) {
    // 更新搜索索引
    const index = await this.getIndex();
    index[conversation.id] = {
      id: conversation.id,
      platform: conversation.platform,
      title: conversation.title,
      updatedAt: conversation.updatedAt
    };
    await chrome.storage.local.set({ '_index': index });
  }
  
  private async getIndex() {
    const result = await chrome.storage.local.get('_index');
    return result._index || {};
  }
}
```

#### 4.3 搜索引擎

```typescript
import Fuse from 'fuse.js';

class SearchEngine {
  private fuse: Fuse<Conversation>;
  
  async initialize(conversations: Conversation[]) {
    this.fuse = new Fuse(conversations, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'messages.content', weight: 1 },
        { name: 'messages.thinking', weight: 0.5 }
      ],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true
    });
  }
  
  search(query: string) {
    return this.fuse.search(query);
  }
  
  highlightMatches(text: string, matches: any[]) {
    // 高亮显示匹配的关键词
    let result = text;
    matches.forEach(match => {
      const [start, end] = match.indices[0];
      const before = result.substring(0, start);
      const highlighted = result.substring(start, end + 1);
      const after = result.substring(end + 1);
      result = `${before}<mark>${highlighted}</mark>${after}`;
    });
    return result;
  }
}
```

### 5. UI 设计

#### 5.1 侧边栏布局

```jsx
// Sidebar.jsx
import React, { useState, useEffect } from 'react';

function Sidebar() {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ total: 0, today: 0 });
  
  useEffect(() => {
    loadConversations();
    loadStats();
  }, []);
  
  const loadConversations = async () => {
    const storage = new StorageManager();
    const data = await storage.getConversations();
    setConversations(data);
  };
  
  const loadStats = async () => {
    // 加载统计数据
    const storage = new StorageManager();
    const all = await storage.getConversations();
    const today = new Date().setHours(0, 0, 0, 0);
    const todayConvs = all.filter(c => c.createdAt >= today);
    
    setStats({
      total: all.length,
      today: todayConvs.length
    });
  };
  
  return (
    <div className="sidebar">
      <header className="header">
        <h1>Chat Memo</h1>
      </header>
      
      <div className="stats">
        <StatsCard label="Total Conversations" value={stats.total} />
        <StatsCard label="Today's New" value={stats.today} />
      </div>
      
      <SearchBar 
        value={searchQuery}
        onChange={setSearchQuery}
      />
      
      <ConversationList 
        conversations={conversations}
        searchQuery={searchQuery}
      />
    </div>
  );
}

function StatsCard({ label, value }) {
  return (
    <div className="stats-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder="Search titles and content..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button className="filter-btn">🔽</button>
    </div>
  );
}

function ConversationList({ conversations, searchQuery }) {
  const filtered = conversations.filter(conv =>
    !searchQuery || 
    conv.title.includes(searchQuery) ||
    conv.messages.some(m => m.content.includes(searchQuery))
  );
  
  return (
    <div className="conversation-list">
      {filtered.map(conv => (
        <ConversationCard key={conv.id} conversation={conv} />
      ))}
    </div>
  );
}

function ConversationCard({ conversation }) {
  const platform = conversation.platform;
  const timeAgo = formatTimeAgo(conversation.updatedAt);
  const messageCount = conversation.messages.length;
  
  return (
    <div className="conversation-card">
      <h3 className="title">{conversation.title}</h3>
      <p className="preview">{getPreview(conversation)}</p>
      <div className="meta">
        <span className="platform">{platform}</span>
        <span className="messages">💬 {messageCount}</span>
        <span className="time">{timeAgo}</span>
      </div>
    </div>
  );
}

function getPreview(conversation) {
  const firstMessage = conversation.messages[0];
  return firstMessage?.content.substring(0, 100) + '...';
}

function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  return `${days} days ago`;
}

export default Sidebar;
```

#### 5.2 样式设计

```css
/* styles.css */
.sidebar {
  width: 400px;
  height: 100vh;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px;
}

.stats-card {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
}

.stats-card .label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.stats-card .value {
  font-size: 32px;
  font-weight: bold;
  color: #2563eb;
}

.search-bar {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.search-bar input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.conversation-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.conversation-card:hover {
  border-color: #2563eb;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.conversation-card .title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.conversation-card .preview {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
  line-height: 1.5;
}

.conversation-card .meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #999;
}

.conversation-card .platform {
  color: #10b981;
  font-weight: 500;
}
```

### 6. 性能优化

#### 6.1 防抖和节流

```typescript
// 防抖：避免频繁保存
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 使用防抖保存
const debouncedSave = debounce(saveConversation, 1000);

// 节流：限制检查频率
function throttle(func: Function, limit: number) {
  let inThrottle: boolean;
  return function(...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 使用节流检查
const throttledCheck = throttle(checkNewMessages, 500);
```

#### 6.2 增量同步

```typescript
class IncrementalSync {
  private lastSyncedHash: Map<string, string> = new Map();
  
  async syncConversation(conversation: Conversation) {
    const currentHash = this.calculateHash(conversation);
    const lastHash = this.lastSyncedHash.get(conversation.id);
    
    // 只有内容真正变化才保存
    if (currentHash !== lastHash) {
      await this.saveConversation(conversation);
      this.lastSyncedHash.set(conversation.id, currentHash);
    }
  }
  
  private calculateHash(conversation: Conversation): string {
    // 简单的哈希实现
    const content = JSON.stringify(conversation.messages);
    return btoa(content);
  }
}
```

#### 6.3 虚拟滚动

```jsx
// 对于大量对话，使用虚拟滚动优化性能
import { FixedSizeList } from 'react-window';

function ConversationList({ conversations }) {
  const Row = ({ index, style }) => {
    const conv = conversations[index];
    return (
      <div style={style}>
        <ConversationCard conversation={conv} />
      </div>
    );
  };
  
  return (
    <FixedSizeList
      height={600}
      itemCount={conversations.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

---

## 📊 开发计划

### 1. 开发阶段

#### Phase 1: 基础框架（2 周）
**目标**：建立可运行的扩展框架

**Week 1**：
- ✅ Day 1-2: 需求细化和技术调研
- ✅ Day 3-4: 搭建 Chrome 扩展基础架构
- ✅ Day 5-7: 实现 Manifest V3 配置

**Week 2**：
- ✅ Day 8-10: 开发 Content Script 基础框架
- ✅ Day 11-12: 实现 Background Service Worker
- ✅ Day 13-14: 设计数据存储结构

**交付物**：
- 可加载的 Chrome 扩展
- 基础的数据存储功能
- 简单的测试页面

#### Phase 2: 平台适配（3 周）
**目标**：完成五大平台的对话捕获

**Week 3**：
- ✅ Day 1-3: ChatGPT 适配和测试
- ✅ Day 4-7: Gemini Pro 适配和测试

**Week 4**：
- ✅ Day 1-4: Claude 适配和测试
- ✅ Day 5-7: Manus 调研和适配

**Week 5**：
- ✅ Day 1-4: Genspark.ai 调研和适配
- ✅ Day 5-7: 全平台联调和优化

**交付物**：
- 五大平台完整适配
- 稳定的消息捕获
- 平台切换测试通过

#### Phase 3: 核心功能（2 周）
**目标**：实现自动保存和基础管理

**Week 6**：
- ✅ Day 1-3: 实现实时保存逻辑
- ✅ Day 4-5: 实现版本控制
- ✅ Day 6-7: 实现基础搜索

**Week 7**：
- ✅ Day 1-3: 实现数据导出功能
- ✅ Day 4-5: 性能优化（防抖、节流）
- ✅ Day 6-7: 功能测试和 Bug 修复

**交付物**：
- 完整的自动保存功能
- 可用的搜索功能
- 数据导出功能

#### Phase 4: UI 开发（2 周）
**目标**：打造简洁易用的界面

**Week 8**：
- ✅ Day 1-3: 设计 UI 原型（参考 Chat Memo）
- ✅ Day 4-5: 开发侧边栏界面
- ✅ Day 6-7: 开发对话详情页

**Week 9**：
- ✅ Day 1-3: 实现浮动状态栏
- ✅ Day 4-5: 优化交互体验
- ✅ Day 6-7: UI 测试和调整

**交付物**：
- 完整的用户界面
- 流畅的交互体验
- 响应式设计

#### Phase 5: 测试优化（1 周）
**目标**：确保产品稳定可靠

**Week 10**：
- ✅ Day 1-2: 功能完整性测试
- ✅ Day 3-4: 性能压力测试
- ✅ Day 5: 兼容性测试
- ✅ Day 6-7: Bug 修复和优化

**交付物**：
- 测试报告
- Bug 清单和修复
- 性能优化报告

#### Phase 6: 发布准备（1 周）
**目标**：准备发布到 Chrome Web Store

**Week 11**：
- ✅ Day 1-2: 准备发布材料（截图、描述）
- ✅ Day 3-4: 编写使用文档
- ✅ Day 5: 提交 Chrome Web Store
- ✅ Day 6-7: 准备运营内容

**交付物**：
- Chrome Web Store 上架
- 完整使用文档
- 运营推广素材

### 2. 里程碑

| 里程碑 | 时间 | 关键成果 | 验收标准 |
|--------|------|----------|----------|
| M1: 框架完成 | Week 2 | 可运行的扩展框架 | 能在 Chrome 中加载并运行 |
| M2: 平台适配完成 | Week 5 | 五大平台全部适配 | 每个平台都能稳定捕获对话 |
| M3: 核心功能完成 | Week 7 | 保存、搜索、导出 | 功能可用，无致命 Bug |
| M4: UI 完成 | Week 9 | 完整用户界面 | 界面美观，交互流畅 |
| M5: 测试完成 | Week 10 | 稳定可发布版本 | 通过所有测试用例 |
| M6: 正式发布 | Week 11 | Chrome Web Store 上架 | 公开可下载使用 |

### 3. 风险管理

#### 3.1 技术风险

**风险 1：平台 DOM 结构变化**
- **影响**：选择器失效，无法捕获对话
- **概率**：中等（AI 平台经常更新）
- **应对**：
  - 设计灵活的适配器模式
  - 建立平台监控机制
  - 提供快速热修复通道

**风险 2：性能问题**
- **影响**：大量数据导致卡顿
- **概率**：高（用户可能有数千条对话）
- **应对**：
  - 使用虚拟滚动
  - 实现分页加载
  - 定期清理过期数据

**风险 3：Chrome API 限制**
- **影响**：存储空间不足
- **概率**：中等
- **应对**：
  - 使用 IndexedDB（理论无限）
  - 提供数据清理功能
  - 引导用户导出备份

#### 3.2 法律风险

**风险 4：违反平台服务条款**
- **影响**：被平台封禁或投诉
- **概率**：低
- **应对**：
  - 仔细研究各平台 ToS
  - 仅在用户授权下运行
  - 数据仅本地存储
  - 不干扰平台正常功能

**风险 5：用户隐私泄露**
- **影响**：用户数据被窃取
- **概率**：极低
- **应对**：
  - 100% 本地存储
  - 不收集任何数据
  - 明确的隐私政策
  - 开源代码（可选）

#### 3.3 市场风险

**风险 6：Chat Memo 竞争压力**
- **影响**：用户选择 Chat Memo
- **概率**：高
- **应对**：
  - 差异化功能定位
  - 专注五大平台
  - 快速迭代优化
  - 建立用户社区

**风险 7：用户需求不足**
- **影响**：用户量少
- **概率**：中等
- **应对**：
  - 先做 MVP 验证
  - 积极收集反馈
  - 灵活调整方向

### 4. 成功指标

#### 4.1 技术指标
- ✅ 五大平台 100% 适配完成
- ✅ 对话保存准确率 > 99%
- ✅ 搜索响应时间 < 500ms
- ✅ 扩展崩溃率 < 0.1%
- ✅ Chrome Web Store 审核通过

#### 4.2 用户指标
- 🎯 前 3 个月获得 500+ 用户
- 🎯 用户日活跃率 > 20%
- 🎯 Chrome Web Store 评分 > 4.3
- 🎯 用户留存率（30 天）> 40%
- 🎯 获得 10+ 五星好评

#### 4.3 产品指标
- 📊 平均每用户保存对话数 > 50
- 📊 搜索功能使用率 > 50%
- 📊 导出功能使用率 > 15%
- 📊 用户反馈响应率 > 80%
- 📊 Bug 修复时间 < 3 天

---

## 💡 创新点与差异化

### 1. 技术创新

#### 1.1 智能版本控制
```
不同于其他产品只保存最终版本
我们保存每次编辑的历史：

用户：给我写一首诗
AI：[第一版回复]
用户：重新生成（不满意）
AI：[第二版回复]
用户：加点浪漫（修改提示）
AI：[第三版回复] ✅ 最终保存这个

价值：
- 了解思考迭代过程
- 学习提示词优化技巧
- 复盘决策过程
```

#### 1.2 跨平台智能续聊
```
场景：
1. 在 ChatGPT 讨论技术方案
2. 免费次数用完
3. 一键复制对话上下文
4. 粘贴到 Claude 继续深入
5. 自动识别并关联对话

价值：
- 充分利用各模型优势
- 避免重复解释背景
- 保持思考连续性
```

### 2. 用户体验创新

#### 2.1 "记忆时光机"
```
功能设计：
- 时间轴视图
- 查看"一年前的今天"聊了什么
- 发现思维变化的轨迹

场景：
用户：我记得去年我也在思考创业方向
系统：显示去年同期的所有对话
用户：对比今昔，看到成长

价值：
- 增强情感连接
- 激发回忆
- 自我认知提升
```

#### 2.2 "灵感卡片"
```
功能设计：
- 自动提取对话中的金句
- 生成精美的卡片
- 一键分享到社交媒体

场景：
AI 说了一句特别精彩的话
用户：标记为"灵感"
系统：生成配图卡片
用户：分享到朋友圈

价值：
- 降低分享门槛
- 增加产品传播
- 提供额外价值
```

### 3. 未来功能构想

#### 3.1 AI 驱动的洞察（V2.0）

**个人 AI 周报**：
```
每周一自动生成：
- 本周讨论的主要话题
- 关键决策和突破点
- 遗留问题和待思考点
- 下周建议关注方向
```

**思维模式分析**：
```
基于长期对话分析：
- 你的提问风格特点
- 思考问题的方式
- 决策时的倾向
- 性格特质推测
```

**知识图谱**：
```
可视化展示：
- 讨论过的话题关系
- 知识领域分布
- 兴趣点变化趋势
```

#### 3.2 团队协作功能（V3.0）

**团队知识库**：
```
场景：
1. 团队成员各自使用 AI
2. 有价值的对话标记为"共享"
3. 自动汇总到团队知识库
4. 新成员快速了解项目背景

价值：
- 知识无缝传递
- 避免重复劳动
- 加速团队协作
```

**协作式 AI 会议**：
```
场景：
1. 会议前，每个人与 AI 讨论议题
2. AI 汇总各方观点
3. 会议中，AI 提供智能提示
4. 会议后，自动生成纪要

价值：
- 提高会议效率
- 减少信息偏差
- 促进深度讨论
```

---

## 📚 学习资源

### 1. 官方文档
- [Chrome Extensions 开发文档](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 迁移指南](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [MutationObserver API](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)

### 2. 相关项目
- [Chat Memo 官网](https://chatmemo.ai/)
- [Chat Memo Chrome 商店](https://chromewebstore.google.com/detail/memnnheiikbfdcobfkghhfihnegkfici)

### 3. 技术博客
- [一泽 Eze 公众号](https://mp.weixin.qq.com/) - AI 工具和提示词
- Chrome Extension 消息传递机制
- IndexedDB 最佳实践
- React 性能优化技巧

### 4. AI Coding 工具
- **Claude Code**：最推荐（Chat Memo 开发者使用）
- **Cursor**：AI 代码编辑器
- **GitHub Copilot**：代码补全

---

## 🎯 下一步行动

### 立即行动（今天）
1. ✅ 完成需求调研报告
2. 🔲 创建 GitHub 仓库
3. 🔲 搭建开发环境（Node.js + Chrome）
4. 🔲 安装 Chat Memo 深度体验

### 本周计划（Week 1）
1. 🔲 实现基础扩展框架
2. 🔲 完成 Manifest V3 配置
3. 🔲 调研 Gemini Pro DOM 结构
4. 🔲 设计数据模型

### 本月目标（Month 1）
1. 🔲 完成三大平台适配（ChatGPT, Gemini, Claude）
2. 🔲 实现核心功能（保存、搜索、导出）
3. 🔲 完成基础 UI 开发
4. 🔲 发布内测版本

### 三个月目标（Quarter 1）
1. 🔲 完成所有五大平台适配
2. 🔲 获得 500+ 用户
3. 🔲 Chrome Web Store 评分 > 4.3
4. 🔲 开始规划 V2.0 功能

---

## 📞 反馈与支持

### 获取帮助
- **GitHub Issues**：[项目地址]
- **Email**：[your-email@example.com]
- **社群**：[Discord/Telegram 链接]

### 贡献方式
- 提交 Bug 报告
- 提出功能建议
- 贡献代码（欢迎 PR）
- 分享使用心得

### 关注我们
- **公众号**：[你的公众号]
- **Twitter**：[@your_handle]
- **产品 Hunt**：[产品页面]

---

## 🙏 致谢

**特别感谢**：
- **一泽 Eze**：Chat Memo 创始人，为我们提供了宝贵的产品思路和开发经验
- **Chat Memo 用户**：他们的反馈帮助我们理解真实需求
- **AI Coding 社区**：让个人开发者也能快速实现想法

**参考项目**：
- Chat Memo
- Cherry Studio
- Flomo
- Second.Me

---

## 📄 附录

### 附录 A: 平台 URL 列表

| 平台 | 主 URL | 备注 |
|------|--------|------|
| ChatGPT | https://chat.openai.com<br>https://chatgpt.com | OpenAI 官方，两个域名 |
| Gemini Pro | https://gemini.google.com | Google 官方 |
| Claude | https://claude.ai | Anthropic 官方 |
| Manus | [待确认] | 需要实际调研 |
| Genspark.ai | https://www.genspark.ai | 需要实际调研 |

### 附录 B: 技术术语表

- **Content Script**：注入到网页中的脚本，可以访问和修改 DOM
- **Background Service Worker**：在后台运行的服务工作线程
- **MutationObserver**：监听 DOM 变化的 Web API
- **IndexedDB**：浏览器端的大容量数据库
- **Manifest V3**：Chrome 扩展的最新规范版本
- **RAG**：检索增强生成（Retrieval-Augmented Generation）
- **Context**：AI 对话中的上下文信息
- **AI Coding**：使用 AI 辅助编程的开发方式

### 附录 C: 开发环境要求

**必需软件**：
- **Node.js**：v16.0+
- **Chrome**：版本 88+
- **代码编辑器**：VS Code（推荐）
- **包管理器**：npm 或 yarn

**推荐工具**：
- **Claude Code** 或 **Cursor**（AI Coding）
- **React DevTools**（Chrome 扩展）
- **Redux DevTools**（如果使用 Redux）
- **Git**：版本控制

**操作系统**：
- Windows 10+
- macOS 10.15+
- Linux（Ubuntu 20.04+）

### 附录 D: 数据结构定义

```typescript
// 完整的类型定义
interface Conversation {
  id: string;                    // 唯一标识
  platform: PlatformType;        // 平台名称
  title: string;                 // 对话标题
  messages: Message[];           // 消息列表
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
  url: string;                   // 原始对话 URL
  tags?: string[];               // 标签（可选）
  starred?: boolean;             // 是否标星（可选）
}

type PlatformType = 
  | 'chatgpt' 
  | 'gemini' 
  | 'claude' 
  | 'manus' 
  | 'genspark';

interface Message {
  id: string;                    // 消息唯一标识
  role: 'user' | 'assistant';    // 角色
  content: string;               // 消息内容
  thinking?: string;             // AI 思考过程（可选）
  artifacts?: Artifact[];        // 附件（可选）
  timestamp: number;             // 时间戳
  edited?: boolean;              // 是否编辑过
  version?: number;              // 版本号
}

interface Artifact {
  type: 'code' | 'image' | 'file';
  content: string;
  language?: string;             // 代码语言（可选）
  filename?: string;             // 文件名（可选）
}
```

### 附录 E: Chrome 扩展权限说明

**必需权限**：
```json
{
  "permissions": [
    "storage",           // 本地存储
    "tabs",             // 标签页访问
    "scripting"         // 脚本注入
  ],
  "host_permissions": [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://gemini.google.com/*",
    "https://claude.ai/*",
    "https://www.manus.app/*",
    "https://www.genspark.ai/*"
  ]
}
```

**权限说明**：
- **storage**：保存对话数据到本地
- **tabs**：获取当前标签页信息
- **scripting**：注入 Content Script
- **host_permissions**：访问特定网站

---

**文档版本**: v2.0  
**最后更新**: 2024-12-07  
**文档作者**: AI 对话记录工具开发团队  
**状态**: 已完成，待开发  

---

## 🚀 开始开发

准备好了吗？让我们开始构建你的 AI 对话记录工具！

**第一步**：
```bash
# 克隆模板仓库（如果有）
git clone [your-repo-url]

# 安装依赖
cd your-project
npm install

# 启动开发服务器
npm run dev

# 在 Chrome 中加载扩展
# 1. 打开 chrome://extensions/
# 2. 开启"开发者模式"
# 3. 点击"加载已解压的扩展程序"
# 4. 选择项目的 dist 目录
```

**开发建议**：
1. 从简单的平台开始（建议 ChatGPT）
2. 先实现基础保存，再优化细节
3. 经常测试，及时发现问题
4. 充分利用 AI Coding 工具
5. 参考 Chat Memo 的设计理念

**祝开发顺利！🎉**
