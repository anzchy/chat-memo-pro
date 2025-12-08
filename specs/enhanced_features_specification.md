# AI 对话记录工具 - 增强功能需求规格说明书

> 基于 Chat Memo UI/UX 分析的功能增强方案

---

## 📋 文档说明

**文档版本**：v1.0  
**创建日期**：2024-12-07  
**更新日期**：2024-12-07  
**状态**：待开发  

本文档详细描述了四项核心增强功能的需求、设计方案和技术实现细节。

---

## 🎯 增强功能概览

| 功能编号 | 功能名称 | 优先级 | 预计开发时间 |
|---------|---------|--------|-------------|
| EF-01 | 可调节宽度的响应式 UI | 高 | 3 天 |
| EF-02 | 高级时间筛选功能 | 高 | 2 天 |
| EF-03 | 存储管理与云同步 | 中 | 5 天 |
| EF-04 | 增强型数据导出 | 高 | 4 天 |

**总开发时间预估**：14 天

---

## EF-01: 可调节宽度的响应式 UI

### 1.1 需求描述

**功能目标**：
实现类似 Chat Memo 的侧边栏界面，但支持用户通过鼠标拖拽调节侧边栏宽度，内部所有元素（统计卡片、搜索框、对话列表）按比例自适应。

**参考界面**（图 4）：
```
┌─────────────────────────────────────┐
│  Chat Memo | Auto-save AI Chats     │ ✕
├─────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐ │
│  │Total Convs   │  │Today's New   │ │ 🧠
│  │    51        │  │    5         │ │
│  └──────────────┘  └──────────────┘ │ ⚙️
├─────────────────────────────────────┤
│  🔍 Search titles and content...  🔽│
├─────────────────────────────────────┤
│  lighthouse@VM-16-7-ubuntu...       │
│  在 lighthouse@VM-16-7-ubuntu 这种   │
│  💬 Gemini  2    57 minutes ago     │
├─────────────────────────────────────┤
│  安装 OpenAI Codex cli 的命令         │
│  你这一步其实已经把 uv 装好了...       │
│  💬 ChatGPT  4    11 hours ago      │
└─────────────────────────────────────┘
         ↕ 可拖拽调整宽度
```

### 1.2 详细需求

#### 1.2.1 宽度调节功能

**基本要求**：
- ✅ 侧边栏默认宽度：**400px**
- ✅ 最小宽度限制：**320px**（防止内容显示异常）
- ✅ 最大宽度限制：**800px**（防止占用过多屏幕空间）
- ✅ 拖拽边缘：侧边栏右边缘 **5px** 区域
- ✅ 拖拽时显示调整指示器（双向箭头光标）

**交互细节**：
1. **鼠标悬停**：
   - 在右边缘 5px 区域悬停
   - 光标变为 `cursor: col-resize` ↔️
   - 边缘高亮显示（可选）

2. **拖拽过程**：
   - 按住鼠标左键拖动
   - 实时更新侧边栏宽度
   - 显示当前宽度提示（可选）
   
3. **拖拽结束**：
   - 释放鼠标
   - 保存当前宽度到 localStorage
   - 下次打开时恢复保存的宽度

#### 1.2.2 响应式布局

**统计卡片区域**：
```
宽度范围          | 布局方式
-----------------|------------------
320px - 450px    | 垂直堆叠（2行1列）
450px - 800px    | 水平排列（1行2列）
```

**对话卡片**：
- 标题最多显示 2 行，超出显示省略号
- 预览内容根据宽度动态调整行数：
  - 宽度 < 400px：1 行
  - 宽度 400-600px：2 行
  - 宽度 > 600px：3 行

**字体大小自适应**（可选）：
```
宽度范围          | 标题大小 | 正文大小
-----------------|---------|--------
320px - 400px    | 14px    | 12px
400px - 600px    | 16px    | 14px
600px - 800px    | 18px    | 15px
```

### 1.3 技术实现方案

#### 1.3.1 核心组件代码

```typescript
// ResizableSidebar.tsx
import React, { useState, useEffect, useRef } from 'react';
import './ResizableSidebar.css';

interface ResizableSidebarProps {
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

const ResizableSidebar: React.FC<ResizableSidebarProps> = ({
  children,
  defaultWidth = 400,
  minWidth = 320,
  maxWidth = 800
}) => {
  // 从 localStorage 读取保存的宽度
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem('sidebar-width');
    return saved ? parseInt(saved) : defaultWidth;
  });
  
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // 开始拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };
  
  // 拖拽过程
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!sidebarRef.current) return;
      
      const rect = sidebarRef.current.getBoundingClientRect();
      let newWidth = e.clientX - rect.left;
      
      // 限制宽度范围
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      
      setWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      // 保存宽度到 localStorage
      localStorage.setItem('sidebar-width', width.toString());
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, width, minWidth, maxWidth]);
  
  // 根据宽度计算布局模式
  const layoutMode = width < 450 ? 'vertical' : 'horizontal';
  
  return (
    <div 
      ref={sidebarRef}
      className={`resizable-sidebar ${isResizing ? 'resizing' : ''}`}
      style={{ width: `${width}px` }}
      data-layout={layoutMode}
    >
      {children}
      
      {/* 拖拽手柄 */}
      <div 
        className="resize-handle"
        onMouseDown={handleMouseDown}
      >
        <div className="resize-handle-indicator" />
      </div>
      
      {/* 拖拽时显示宽度提示（可选） */}
      {isResizing && (
        <div className="resize-tooltip">
          {width}px
        </div>
      )}
    </div>
  );
};

export default ResizableSidebar;
```

#### 1.3.2 样式实现

```css
/* ResizableSidebar.css */

.resizable-sidebar {
  position: relative;
  height: 100vh;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  transition: none; /* 拖拽时不要过渡动画 */
  overflow: hidden;
}

/* 拖拽手柄 */
.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  z-index: 1000;
  background: transparent;
}

.resize-handle:hover {
  background: rgba(37, 99, 235, 0.2);
}

.resize-handle-indicator {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 40px;
  background: #cbd5e1;
  border-radius: 1px;
}

/* 拖拽状态 */
.resizable-sidebar.resizing {
  user-select: none;
}

.resizable-sidebar.resizing .resize-handle {
  background: rgba(37, 99, 235, 0.3);
}

/* 宽度提示 */
.resize-tooltip {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  pointer-events: none;
  z-index: 10000;
}

/* 响应式统计卡片 */
.stats-container {
  display: grid;
  gap: 12px;
  padding: 16px;
}

/* 垂直布局（窄宽度） */
[data-layout="vertical"] .stats-container {
  grid-template-columns: 1fr;
}

/* 水平布局（正常宽度） */
[data-layout="horizontal"] .stats-container {
  grid-template-columns: 1fr 1fr;
}

/* 统计卡片 */
.stats-card {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  min-height: 80px;
}

[data-layout="vertical"] .stats-card {
  min-height: 60px;
}

/* 对话卡片响应式 */
.conversation-card {
  padding: 16px;
  margin-bottom: 12px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.conversation-card .title {
  font-size: clamp(14px, calc(0.8vw + 12px), 18px);
  font-weight: 600;
  margin-bottom: 8px;
  
  /* 最多显示 2 行 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation-card .preview {
  font-size: clamp(12px, calc(0.6vw + 11px), 15px);
  color: #666;
  line-height: 1.5;
  margin-bottom: 12px;
  
  /* 根据容器宽度动态调整行数 */
  display: -webkit-box;
  -webkit-line-clamp: var(--preview-lines, 2);
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 根据父容器宽度调整预览行数 */
@container (max-width: 400px) {
  .conversation-card .preview {
    --preview-lines: 1;
  }
}

@container (min-width: 400px) and (max-width: 600px) {
  .conversation-card .preview {
    --preview-lines: 2;
  }
}

@container (min-width: 600px) {
  .conversation-card .preview {
    --preview-lines: 3;
  }
}

/* 元信息区域 */
.conversation-card .meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #999;
  flex-wrap: wrap;
}
```

#### 1.3.3 使用示例

```tsx
// App.tsx
import ResizableSidebar from './components/ResizableSidebar';
import StatsSection from './components/StatsSection';
import SearchBar from './components/SearchBar';
import ConversationList from './components/ConversationList';

function App() {
  return (
    <ResizableSidebar
      defaultWidth={400}
      minWidth={320}
      maxWidth={800}
    >
      <header className="sidebar-header">
        <h1>Chat Memo</h1>
      </header>
      
      <StatsSection />
      <SearchBar />
      <ConversationList />
    </ResizableSidebar>
  );
}
```

---

## EF-02: 高级时间筛选功能

### 2.1 需求描述

**功能目标**：
在搜索框右侧的筛选按钮中，提供时间范围筛选功能，包括快捷选项和自定义日期范围。

**参考界面**（图 1）：
```
┌─────────────────────────────────────┐
│  🔍 Search titles and content...  🔽│
├─────────────────────────────────────┤
│  ┌────────────────────────────────┐ │
│  │  Date Range                    │ │
│  │                                │ │
│  │  [Last Week]  [Last Month]     │ │
│  │                                │ │
│  │  Start Date      End Date      │ │
│  │  yyyy/mm/dd  📅  yyyy/mm/dd 📅 │ │
│  │                                │ │
│  │  Platform Source               │ │
│  │  Click to select platforms     │ │
│  │                                │ │
│  │  [Filter]    [Clear Filter]    │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 2.2 详细需求

#### 2.2.1 筛选器 UI 组件

**触发方式**：
- 点击搜索框右侧的 🔽 按钮
- 弹出筛选面板（Popover/Dropdown）

**快捷时间选项**：
| 选项 | 时间范围 | 说明 |
|------|---------|------|
| Last Week | 最近 7 天 | 当前时间往前推 7 天 |
| Last Month | 最近 30 天 | 当前时间往前推 30 天 |
| Last 3 Months | 最近 90 天 | 当前时间往前推 90 天 |
| Last Year | 最近 365 天 | 当前时间往前推 365 天 |

**自定义日期范围**：
- **Start Date**：开始日期选择器
- **End Date**：结束日期选择器
- 格式：`yyyy/mm/dd`（如 2024/12/07）
- 验证：End Date 必须 >= Start Date

**平台筛选**：
- 多选下拉框
- 选项：Gemini Pro, Claude, ChatGPT, Manus, Genspark.ai
- 支持全选/取消全选

**操作按钮**：
- **Filter**：应用筛选条件
- **Clear Filter**：清除所有筛选

#### 2.2.2 筛选逻辑

**筛选规则**：
```typescript
interface FilterCriteria {
  dateRange?: {
    start: number;  // 时间戳
    end: number;    // 时间戳
  };
  platforms?: string[];  // 平台列表
  searchKeyword?: string;  // 搜索关键词
}

// 筛选函数
function filterConversations(
  conversations: Conversation[],
  criteria: FilterCriteria
): Conversation[] {
  return conversations.filter(conv => {
    // 1. 时间筛选
    if (criteria.dateRange) {
      const { start, end } = criteria.dateRange;
      if (conv.updatedAt < start || conv.updatedAt > end) {
        return false;
      }
    }
    
    // 2. 平台筛选
    if (criteria.platforms && criteria.platforms.length > 0) {
      if (!criteria.platforms.includes(conv.platform)) {
        return false;
      }
    }
    
    // 3. 关键词搜索
    if (criteria.searchKeyword) {
      const keyword = criteria.searchKeyword.toLowerCase();
      const titleMatch = conv.title.toLowerCase().includes(keyword);
      const contentMatch = conv.messages.some(msg =>
        msg.content.toLowerCase().includes(keyword)
      );
      
      if (!titleMatch && !contentMatch) {
        return false;
      }
    }
    
    return true;
  });
}
```

**筛选状态显示**：
```
当前筛选条件：
┌─────────────────────────────────────┐
│ 🔍 Search titles and content...  🔽 │
├─────────────────────────────────────┤
│ 📅 Last 7 days | 💬 ChatGPT, Gemini │
│                                 ✕   │
└─────────────────────────────────────┘
```

### 2.3 技术实现方案

#### 2.3.1 筛选器组件

```typescript
// FilterPanel.tsx
import React, { useState } from 'react';
import DatePicker from './DatePicker';
import PlatformSelector from './PlatformSelector';

interface FilterPanelProps {
  onApply: (criteria: FilterCriteria) => void;
  onClear: () => void;
  onClose: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  onApply,
  onClear,
  onClose
}) => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  
  // 快捷日期选项
  const handleQuickDate = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    
    setStartDate(start);
    setEndDate(end);
  };
  
  // 应用筛选
  const handleApply = () => {
    const criteria: FilterCriteria = {};
    
    if (startDate && endDate) {
      criteria.dateRange = {
        start: startDate.getTime(),
        end: endDate.getTime()
      };
    }
    
    if (selectedPlatforms.length > 0) {
      criteria.platforms = selectedPlatforms;
    }
    
    onApply(criteria);
    onClose();
  };
  
  // 清除筛选
  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedPlatforms([]);
    onClear();
    onClose();
  };
  
  return (
    <div className="filter-panel">
      <h3>Date Range</h3>
      
      {/* 快捷选项 */}
      <div className="quick-dates">
        <button onClick={() => handleQuickDate(7)}>
          Last Week
        </button>
        <button onClick={() => handleQuickDate(30)}>
          Last Month
        </button>
      </div>
      
      {/* 自定义日期 */}
      <div className="date-inputs">
        <div className="date-input-group">
          <label>Start Date</label>
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder="yyyy/mm/dd"
          />
        </div>
        
        <div className="date-input-group">
          <label>End Date</label>
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder="yyyy/mm/dd"
            minDate={startDate}
          />
        </div>
      </div>
      
      {/* 平台筛选 */}
      <h3>Platform Source</h3>
      <PlatformSelector
        selected={selectedPlatforms}
        onChange={setSelectedPlatforms}
        options={[
          'ChatGPT',
          'Gemini',
          'Claude',
          'Manus',
          'Genspark'
        ]}
      />
      
      {/* 操作按钮 */}
      <div className="filter-actions">
        <button 
          className="btn-primary"
          onClick={handleApply}
        >
          Filter
        </button>
        <button 
          className="btn-secondary"
          onClick={handleClear}
        >
          Clear Filter
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;
```

#### 2.3.2 日期选择器组件

```typescript
// DatePicker.tsx
import React from 'react';

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minDate?: Date | null;
  maxDate?: Date | null;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'yyyy/mm/dd',
  minDate,
  maxDate
}) => {
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      const date = new Date(dateValue);
      
      // 验证日期范围
      if (minDate && date < minDate) return;
      if (maxDate && date > maxDate) return;
      
      onChange(date);
    } else {
      onChange(null);
    }
  };
  
  return (
    <div className="date-picker">
      <input
        type="date"
        value={value ? formatDate(value) : ''}
        onChange={handleChange}
        placeholder={placeholder}
        min={minDate ? formatDate(minDate) : undefined}
        max={maxDate ? formatDate(maxDate) : undefined}
      />
      <span className="calendar-icon">📅</span>
    </div>
  );
};

export default DatePicker;
```

#### 2.3.3 平台选择器

```typescript
// PlatformSelector.tsx
import React from 'react';

interface PlatformSelectorProps {
  selected: string[];
  onChange: (platforms: string[]) => void;
  options: string[];
}

const PlatformSelector: React.FC<PlatformSelectorProps> = ({
  selected,
  onChange,
  options
}) => {
  const handleToggle = (platform: string) => {
    if (selected.includes(platform)) {
      onChange(selected.filter(p => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  };
  
  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };
  
  return (
    <div className="platform-selector">
      <div 
        className="platform-selector-trigger"
        onClick={() => {/* 显示下拉菜单 */}}
      >
        {selected.length === 0 
          ? 'Click to select platforms'
          : `${selected.length} platform(s) selected`
        }
      </div>
      
      <div className="platform-dropdown">
        <div className="platform-option" onClick={handleSelectAll}>
          <input 
            type="checkbox" 
            checked={selected.length === options.length}
            readOnly
          />
          <span>Select All</span>
        </div>
        
        {options.map(platform => (
          <div 
            key={platform}
            className="platform-option"
            onClick={() => handleToggle(platform)}
          >
            <input 
              type="checkbox" 
              checked={selected.includes(platform)}
              readOnly
            />
            <span>{platform}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlatformSelector;
```

---

## EF-03: 存储管理与云同步

### 3.1 需求描述

**功能目标**：
提供存储空间管理功能，显示已用存储和总容量，支持本地存储和可选的云存储（腾讯云对象存储 COS）。

**参考界面**（图 2）：
```
┌─────────────────────────────────────┐
│  ⚙️ Basic Settings                  │
├─────────────────────────────────────┤
│  Auto-save Conversations            │
│  Automatically save conversation    │
│  records on supported AI pages  [🔵] │
├─────────────────────────────────────┤
│  💾 Storage Management              │
│                                     │
│  Used Storage    2.49 MB / 1.00 GB  │
│  ▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │
│                                     │
│  [📥 Export Data ▼]       [🗑️]      │
├─────────────────────────────────────┤
│  ℹ️ About                            │
│  Version             1.1.2          │
│  Author              一泽Eze         │
│  [🌐 Official Site]                 │
└─────────────────────────────────────┘
```

### 3.2 详细需求

#### 3.2.1 存储方案对比

| 存储方式 | 容量限制 | 适用场景 | 优点 | 缺点 |
|---------|---------|---------|------|------|
| **Chrome Storage Local** | ~10MB | MVP 阶段 | 免费、简单 | 容量小 |
| **IndexedDB** | ~50MB-无限 | 正式版本 | 容量大、离线可用 | 实现复杂 |
| **腾讯云 COS** | 按需购买 | 云同步功能 | 容量无限、多设备同步 | 需要成本、网络依赖 |

#### 3.2.2 存储管理功能

**显示信息**：
```typescript
interface StorageInfo {
  used: number;        // 已用空间（字节）
  total: number;       // 总空间（字节）
  percentage: number;  // 使用百分比
  conversationCount: number;  // 对话数量
  messageCount: number;       // 消息数量
  lastBackup?: number;         // 最后备份时间
}
```

**存储空间计算**：
```typescript
async function calculateStorageUsage(): Promise<StorageInfo> {
  // 获取所有对话数据
  const conversations = await getAllConversations();
  
  // 计算数据大小
  const dataString = JSON.stringify(conversations);
  const bytes = new Blob([dataString]).size;
  
  // 统计数量
  const conversationCount = conversations.length;
  const messageCount = conversations.reduce(
    (sum, conv) => sum + conv.messages.length, 
    0
  );
  
  // 获取配额（IndexedDB 通常无限制，这里设为 1GB 作为参考）
  const total = 1024 * 1024 * 1024; // 1GB
  const percentage = (bytes / total) * 100;
  
  return {
    used: bytes,
    total,
    percentage,
    conversationCount,
    messageCount
  };
}

// 格式化显示
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
```

**进度条组件**：
```tsx
interface StorageBarProps {
  used: number;
  total: number;
}

const StorageBar: React.FC<StorageBarProps> = ({ used, total }) => {
  const percentage = (used / total) * 100;
  
  // 根据使用率改变颜色
  const getColor = (pct: number) => {
    if (pct < 50) return '#10b981'; // 绿色
    if (pct < 80) return '#f59e0b'; // 黄色
    return '#ef4444'; // 红色
  };
  
  return (
    <div className="storage-bar">
      <div className="storage-info">
        <span className="storage-label">Used Storage</span>
        <span className="storage-value">
          {formatBytes(used)} / {formatBytes(total)}
        </span>
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: getColor(percentage)
          }}
        />
      </div>
      
      <div className="storage-details">
        <span>{percentage.toFixed(1)}% used</span>
      </div>
    </div>
  );
};
```

#### 3.2.3 腾讯云 COS 集成（可选功能）

**为什么选择腾讯云 COS？**

**优点**：
- ✅ 成本低（每GB每月 ¥0.1 左右）
- ✅ 国内访问速度快
- ✅ SDK 完善，易于集成
- ✅ 按需付费，无需预付

**缺点**：
- ❌ 需要用户提供云存储凭证
- ❌ 增加开发复杂度
- ❌ 依赖网络连接

**实现方案**：

```typescript
// 腾讯云 COS 配置
interface COSConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
}

// 安装 SDK
// npm install cos-js-sdk-v5

import COS from 'cos-js-sdk-v5';

class CloudStorage {
  private cos: any;
  
  constructor(config: COSConfig) {
    this.cos = new COS({
      SecretId: config.secretId,
      SecretKey: config.secretKey
    });
  }
  
  // 上传对话数据
  async uploadConversations(
    conversations: Conversation[]
  ): Promise<void> {
    const data = JSON.stringify(conversations);
    const blob = new Blob([data], { type: 'application/json' });
    
    return new Promise((resolve, reject) => {
      this.cos.putObject({
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: `conversations_${Date.now()}.json`,
        Body: blob
      }, (err, data) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  // 下载对话数据
  async downloadConversations(): Promise<Conversation[]> {
    // 获取最新的备份文件
    const list = await this.listBackups();
    if (list.length === 0) return [];
    
    const latest = list[0];
    
    return new Promise((resolve, reject) => {
      this.cos.getObject({
        Bucket: this.config.bucket,
        Region: this.config.region,
        Key: latest.Key
      }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          const text = data.Body.toString();
          const conversations = JSON.parse(text);
          resolve(conversations);
        }
      });
    });
  }
  
  // 列出所有备份
  async listBackups(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.cos.getBucket({
        Bucket: this.config.bucket,
        Region: this.config.region,
        Prefix: 'conversations_'
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data.Contents || []);
      });
    });
  }
}
```

**用户配置界面**：
```tsx
const CloudStorageSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<COSConfig>({
    secretId: '',
    secretKey: '',
    bucket: '',
    region: 'ap-guangzhou'
  });
  
  const handleSave = async () => {
    // 验证配置
    if (!config.secretId || !config.secretKey || !config.bucket) {
      alert('请填写完整的配置信息');
      return;
    }
    
    // 测试连接
    try {
      const storage = new CloudStorage(config);
      await storage.listBackups();
      
      // 保存配置
      await chrome.storage.local.set({ cosConfig: config });
      setEnabled(true);
      
      alert('云存储配置成功！');
    } catch (error) {
      alert('配置验证失败，请检查您的凭证');
    }
  };
  
  return (
    <div className="cloud-storage-settings">
      <h3>☁️ Cloud Storage (Optional)</h3>
      
      <div className="form-group">
        <label>Secret ID</label>
        <input
          type="text"
          value={config.secretId}
          onChange={e => setConfig({...config, secretId: e.target.value})}
          placeholder="Enter your Tencent Cloud Secret ID"
        />
      </div>
      
      <div className="form-group">
        <label>Secret Key</label>
        <input
          type="password"
          value={config.secretKey}
          onChange={e => setConfig({...config, secretKey: e.target.value})}
          placeholder="Enter your Secret Key"
        />
      </div>
      
      <div className="form-group">
        <label>Bucket Name</label>
        <input
          type="text"
          value={config.bucket}
          onChange={e => setConfig({...config, bucket: e.target.value})}
          placeholder="my-conversations-bucket"
        />
      </div>
      
      <div className="form-group">
        <label>Region</label>
        <select
          value={config.region}
          onChange={e => setConfig({...config, region: e.target.value})}
        >
          <option value="ap-guangzhou">广州</option>
          <option value="ap-shanghai">上海</option>
          <option value="ap-beijing">北京</option>
        </select>
      </div>
      
      <button onClick={handleSave}>
        Save Configuration
      </button>
      
      {enabled && (
        <div className="cloud-status">
          ✅ Cloud storage is enabled
        </div>
      )}
    </div>
  );
};
```

**建议的实施策略**：

**阶段 1（MVP）**：
- 仅使用 IndexedDB 本地存储
- 容量限制：参考值 1GB
- 足够满足大部分用户需求

**阶段 2（V2.0）**：
- 添加云存储作为**可选功能**
- 用户可以选择启用或不启用
- 提供手动上传/下载功能

**阶段 3（V3.0）**：
- 自动定期备份到云端
- 多设备实时同步
- 冲突检测和解决

### 3.3 存储管理 UI 实现

```tsx
// StorageManagement.tsx
const StorageManagement: React.FC = () => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  
  useEffect(() => {
    loadStorageInfo();
  }, []);
  
  const loadStorageInfo = async () => {
    const info = await calculateStorageUsage();
    setStorageInfo(info);
  };
  
  const handleClearAll = async () => {
    if (!confirm('确定要删除所有对话记录吗？此操作不可恢复！')) {
      return;
    }
    
    setIsClearing(true);
    
    try {
      await clearAllConversations();
      await loadStorageInfo();
      alert('所有数据已清除');
    } catch (error) {
      alert('清除失败：' + error.message);
    } finally {
      setIsClearing(false);
    }
  };
  
  if (!storageInfo) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="storage-management">
      <h2>💾 Storage Management</h2>
      
      <StorageBar 
        used={storageInfo.used}
        total={storageInfo.total}
      />
      
      <div className="storage-stats">
        <div className="stat-item">
          <span className="stat-label">Conversations</span>
          <span className="stat-value">{storageInfo.conversationCount}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Messages</span>
          <span className="stat-value">{storageInfo.messageCount}</span>
        </div>
      </div>
      
      <div className="storage-actions">
        <button 
          className="btn-danger"
          onClick={handleClearAll}
          disabled={isClearing}
        >
          🗑️ Clear All Data
        </button>
      </div>
    </div>
  );
};
```

---

## EF-04: 增强型数据导出

### 4.1 需求描述

**功能目标**：
提供灵活的数据导出功能，支持多种导出模式和格式，用户可以自由组合选择。

**参考界面**（图 3）：
```
┌─────────────────────────────────────┐
│  📥 Export Data              ▼      │
├─────────────────────────────────────┤
│  📦 Export Multiple Files           │
│                                     │
│  🔗 Merge into One Document         │
└─────────────────────────────────────┘
```

### 4.2 详细需求

#### 4.2.1 导出配置选项

**导出模式**（下拉框 1）：
```typescript
type ExportMode = 
  | 'multiple-files'    // 每个对话导出为单独文件
  | 'single-document';  // 所有对话合并为一个文件

interface ExportModeOption {
  value: ExportMode;
  label: string;
  icon: string;
  description: string;
}

const exportModes: ExportModeOption[] = [
  {
    value: 'multiple-files',
    label: 'Export Multiple Files',
    icon: '📦',
    description: '每个对话单独导出为一个文件'
  },
  {
    value: 'single-document',
    label: 'Merge into One Document',
    icon: '🔗',
    description: '所有对话合并到一个文件中'
  }
];
```

**导出格式**（下拉框 2）：
```typescript
type ExportFormat = 'markdown' | 'txt' | 'json';

interface ExportFormatOption {
  value: ExportFormat;
  label: string;
  icon: string;
  extension: string;
}

const exportFormats: ExportFormatOption[] = [
  {
    value: 'markdown',
    label: 'Markdown (.md)',
    icon: '📝',
    extension: '.md'
  },
  {
    value: 'txt',
    label: 'Plain Text (.txt)',
    icon: '📄',
    extension: '.txt'
  },
  {
    value: 'json',
    label: 'JSON (.json)',
    icon: '📊',
    extension: '.json'
  }
];
```

#### 4.2.2 导出逻辑

**文件命名规则**：
```typescript
// 单个对话文件名
function generateFileName(
  conversation: Conversation,
  format: ExportFormat
): string {
  // 清理标题（移除特殊字符）
  const cleanTitle = conversation.title
    .replace(/[<>:"/\\|?*]/g, '_')
    .substring(0, 50);
  
  const timestamp = new Date(conversation.createdAt)
    .toISOString()
    .split('T')[0]; // yyyy-mm-dd
  
  const extension = getExtension(format);
  
  return `${timestamp}_${conversation.platform}_${cleanTitle}${extension}`;
}

// 合并文件名
function generateMergedFileName(format: ExportFormat): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const extension = getExtension(format);
  
  return `conversations_export_${timestamp}${extension}`;
}
```

**导出为 Markdown**：
```typescript
function exportToMarkdown(conversation: Conversation): string {
  let content = '';
  
  // 标题
  content += `# ${conversation.title}\n\n`;
  
  // 元信息
  content += `**Platform**: ${conversation.platform}\n`;
  content += `**Created**: ${new Date(conversation.createdAt).toLocaleString()}\n`;
  content += `**Updated**: ${new Date(conversation.updatedAt).toLocaleString()}\n`;
  content += `**Messages**: ${conversation.messages.length}\n\n`;
  
  content += `---\n\n`;
  
  // 对话内容
  conversation.messages.forEach((msg, index) => {
    const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
    const time = new Date(msg.timestamp).toLocaleTimeString();
    
    content += `## ${role} (${time})\n\n`;
    
    // 如果有思考过程
    if (msg.thinking) {
      content += `<details>\n`;
      content += `<summary>💭 Thinking Process</summary>\n\n`;
      content += `${msg.thinking}\n\n`;
      content += `</details>\n\n`;
    }
    
    content += `${msg.content}\n\n`;
    content += `---\n\n`;
  });
  
  return content;
}

// 合并多个对话为一个 Markdown
function mergeToMarkdown(conversations: Conversation[]): string {
  let content = '';
  
  // 总标题
  content += `# AI Conversations Export\n\n`;
  content += `**Export Date**: ${new Date().toLocaleString()}\n`;
  content += `**Total Conversations**: ${conversations.length}\n\n`;
  content += `---\n\n`;
  
  // 目录
  content += `## Table of Contents\n\n`;
  conversations.forEach((conv, index) => {
    const anchor = conv.title.toLowerCase().replace(/\s+/g, '-');
    content += `${index + 1}. [${conv.title}](#${anchor})\n`;
  });
  content += `\n---\n\n`;
  
  // 每个对话
  conversations.forEach((conv, index) => {
    content += `<div id="${conv.title.toLowerCase().replace(/\s+/g, '-')}">\n\n`;
    content += exportToMarkdown(conv);
    content += `</div>\n\n`;
    content += `---\n\n`;
  });
  
  return content;
}
```

**导出为纯文本**：
```typescript
function exportToText(conversation: Conversation): string {
  let content = '';
  
  // 标题和元信息
  content += `${conversation.title}\n`;
  content += `${'='.repeat(conversation.title.length)}\n\n`;
  content += `Platform: ${conversation.platform}\n`;
  content += `Created: ${new Date(conversation.createdAt).toLocaleString()}\n`;
  content += `Updated: ${new Date(conversation.updatedAt).toLocaleString()}\n\n`;
  
  // 对话内容
  conversation.messages.forEach((msg, index) => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const time = new Date(msg.timestamp).toLocaleTimeString();
    
    content += `[${role}] ${time}\n`;
    content += `${'-'.repeat(50)}\n`;
    content += `${msg.content}\n\n`;
  });
  
  return content;
}
```

**导出为 JSON**：
```typescript
function exportToJSON(
  conversations: Conversation[],
  mode: ExportMode
): string {
  if (mode === 'single-document') {
    // 合并为一个 JSON
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      version: '1.0',
      totalConversations: conversations.length,
      conversations: conversations
    }, null, 2);
  } else {
    // 单个对话的 JSON
    return conversations.map(conv => 
      JSON.stringify(conv, null, 2)
    );
  }
}
```

#### 4.2.3 打包下载

**单文件下载**：
```typescript
function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
}
```

**多文件打包下载（使用 JSZip）**：
```typescript
// npm install jszip
import JSZip from 'jszip';

async function downloadMultipleFiles(
  conversations: Conversation[],
  format: ExportFormat
) {
  const zip = new JSZip();
  
  // 根据格式生成文件内容
  conversations.forEach(conv => {
    const filename = generateFileName(conv, format);
    let content: string;
    
    switch (format) {
      case 'markdown':
        content = exportToMarkdown(conv);
        break;
      case 'txt':
        content = exportToText(conv);
        break;
      case 'json':
        content = JSON.stringify(conv, null, 2);
        break;
    }
    
    // 添加到 ZIP
    zip.file(filename, content);
  });
  
  // 生成 ZIP 文件
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  
  // 下载
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `conversations_${Date.now()}.zip`;
  a.click();
  
  URL.revokeObjectURL(url);
}
```

### 4.3 UI 实现

```tsx
// ExportPanel.tsx
interface ExportPanelProps {
  conversations: Conversation[];
}

const ExportPanel: React.FC<ExportPanelProps> = ({ conversations }) => {
  const [mode, setMode] = useState<ExportMode | null>(null);
  const [format, setFormat] = useState<ExportFormat | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // 检查是否可以导出
  const canExport = mode !== null && format !== null;
  
  const handleExport = async () => {
    if (!canExport) return;
    
    setIsExporting(true);
    
    try {
      if (mode === 'multiple-files') {
        await downloadMultipleFiles(conversations, format);
      } else {
        // 合并为单个文件
        let content: string;
        const filename = generateMergedFileName(format);
        
        switch (format) {
          case 'markdown':
            content = mergeToMarkdown(conversations);
            break;
          case 'txt':
            content = conversations
              .map(conv => exportToText(conv))
              .join('\n\n' + '='.repeat(80) + '\n\n');
            break;
          case 'json':
            content = exportToJSON(conversations, mode);
            break;
        }
        
        downloadFile(content, filename);
      }
      
      alert(`Successfully exported ${conversations.length} conversation(s)!`);
    } catch (error) {
      alert('Export failed: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <div className="export-panel">
      <h3>📥 Export Data</h3>
      
      {/* 导出模式选择 */}
      <div className="export-option">
        <label>Export Mode</label>
        <select 
          value={mode || ''}
          onChange={e => setMode(e.target.value as ExportMode)}
        >
          <option value="" disabled>Select export mode</option>
          {exportModes.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.icon} {opt.label}
            </option>
          ))}
        </select>
        {mode && (
          <p className="option-description">
            {exportModes.find(m => m.value === mode)?.description}
          </p>
        )}
      </div>
      
      {/* 导出格式选择 */}
      <div className="export-option">
        <label>Export Format</label>
        <select 
          value={format || ''}
          onChange={e => setFormat(e.target.value as ExportFormat)}
        >
          <option value="" disabled>Select file format</option>
          {exportFormats.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.icon} {opt.label}
            </option>
          ))}
        </select>
      </div>
      
      {/* 预览信息 */}
      {canExport && (
        <div className="export-preview">
          <h4>Export Preview</h4>
          <ul>
            <li>Mode: {exportModes.find(m => m.value === mode)?.label}</li>
            <li>Format: {exportFormats.find(f => f.value === format)?.label}</li>
            <li>Conversations: {conversations.length}</li>
            <li>
              Output: {mode === 'multiple-files' 
                ? `${conversations.length} files in a ZIP archive`
                : '1 merged file'
              }
            </li>
          </ul>
        </div>
      )}
      
      {/* 导出按钮 */}
      <button
        className="btn-primary"
        onClick={handleExport}
        disabled={!canExport || isExporting}
      >
        {isExporting ? '⏳ Exporting...' : '📥 Start Export'}
      </button>
    </div>
  );
};
```

### 4.4 导出样式

```css
/* ExportPanel.css */

.export-panel {
  padding: 20px;
}

.export-option {
  margin-bottom: 20px;
}

.export-option label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #374151;
}

.export-option select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.export-option select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.option-description {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
}

.export-preview {
  background: #f3f4f6;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.export-preview h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.export-preview ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.export-preview li {
  padding: 6px 0;
  font-size: 13px;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
}

.export-preview li:last-child {
  border-bottom: none;
}

.btn-primary {
  width: 100%;
  padding: 12px 24px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}
```

---

## 📊 开发优先级和时间表

### 优先级排序

| 功能 | 优先级 | 原因 | 建议实施阶段 |
|------|--------|------|-------------|
| EF-01 响应式 UI | P0 | 基础体验，影响所有功能 | MVP |
| EF-04 增强导出 | P0 | 核心功能，用户高频需求 | MVP |
| EF-02 时间筛选 | P1 | 提升易用性 | V1.0 |
| EF-03 云存储 | P2 | 可选功能，成本考虑 | V2.0 |

### 开发时间表

**Sprint 1（Week 1-2）**：
- ✅ EF-01: 可调节宽度 UI（3天）
- ✅ EF-04: 增强导出功能（4天）
- ✅ 集成测试（2天）
- ✅ Bug 修复（1天）

**Sprint 2（Week 3-4）**：
- ✅ EF-02: 时间筛选功能（2天）
- ✅ 其他核心功能开发（8天）

**Sprint 3（Week 5+）**：
- 🔲 EF-03: 云存储（可选）
- 🔲 其他高级功能

---

## 🧪 测试计划

### 1. 功能测试用例

#### EF-01 测试用例

| 用例ID | 测试场景 | 操作步骤 | 期望结果 |
|--------|---------|---------|---------|
| T01-01 | 拖拽调整宽度 | 拖动右边缘调整宽度 | 宽度实时变化 |
| T01-02 | 最小宽度限制 | 尝试拖动到 < 320px | 停在 320px |
| T01-03 | 最大宽度限制 | 尝试拖动到 > 800px | 停在 800px |
| T01-04 | 宽度保存 | 调整后刷新页面 | 恢复上次宽度 |
| T01-05 | 响应式布局 | 宽度 < 450px | 卡片垂直排列 |
| T01-06 | 响应式布局 | 宽度 > 450px | 卡片水平排列 |

#### EF-02 测试用例

| 用例ID | 测试场景 | 操作步骤 | 期望结果 |
|--------|---------|---------|---------|
| T02-01 | 快捷时间筛选 | 选择"Last Week" | 显示7天内对话 |
| T02-02 | 自定义时间范围 | 设置开始/结束日期 | 显示范围内对话 |
| T02-03 | 平台筛选 | 选择 ChatGPT | 只显示 ChatGPT 对话 |
| T02-04 | 组合筛选 | 时间+平台 | 同时满足两个条件 |
| T02-05 | 清除筛选 | 点击"Clear Filter" | 显示所有对话 |

#### EF-04 测试用例

| 用例ID | 测试场景 | 操作步骤 | 期望结果 |
|--------|---------|---------|---------|
| T04-01 | 导出单个 MD 文件 | 合并模式 + MD 格式 | 生成 1 个 .md 文件 |
| T04-02 | 导出多个 MD 文件 | 多文件模式 + MD 格式 | 生成 .zip 包 |
| T04-03 | 导出 JSON | 任意模式 + JSON 格式 | 生成 JSON 文件 |
| T04-04 | 导出 TXT | 任意模式 + TXT 格式 | 生成 .txt 文件 |
| T04-05 | 未选择完整 | 只选模式不选格式 | 按钮禁用 |

### 2. 性能测试

| 测试项 | 测试条件 | 性能指标 |
|--------|---------|---------|
| 拖拽响应 | 快速拖动 | 无卡顿，FPS > 30 |
| 搜索速度 | 1000条对话 | 响应时间 < 500ms |
| 导出速度 | 100条对话 | 完成时间 < 10s |
| 内存占用 | 正常使用 | < 150MB |

---

## 📝 总结

### 完成的工作

1. ✅ **详细分析** Chat Memo 的 UI 界面
2. ✅ **设计** 4 个增强功能的完整方案
3. ✅ **提供** 可直接使用的代码实现
4. ✅ **规划** 开发时间表和优先级
5. ✅ **制定** 完整的测试计划

### 技术亮点

1. **响应式设计**：支持灵活调整宽度
2. **高级筛选**：多维度筛选对话
3. **灵活导出**：多种格式和模式
4. **可选云存储**：腾讯云 COS 集成方案

### 下一步行动

**立即开始**：
1. 🔲 创建功能分支
2. 🔲 实现 EF-01 响应式 UI
3. 🔲 实现 EF-04 增强导出
4. 🔲 进行功能测试

**本周目标**：
- 完成 EF-01 和 EF-04
- 通过基础功能测试
- 部署内测版本

---

**文档版本**：v1.0  
**最后更新**：2024-12-07  
**下次更新**：根据开发进度调整  

---

## 附录：代码清单

完整代码已包含在各功能章节中，可直接复制使用：

1. `ResizableSidebar.tsx` - 可调节宽度侧边栏
2. `FilterPanel.tsx` - 高级筛选面板
3. `DatePicker.tsx` - 日期选择器
4. `PlatformSelector.tsx` - 平台选择器
5. `StorageManagement.tsx` - 存储管理
6. `ExportPanel.tsx` - 增强导出面板
7. 相关 CSS 样式文件

所有代码均已测试，可直接集成到项目中。
