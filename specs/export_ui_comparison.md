# 导出功能 UI 设计方案详解

> 两种方案的完整对比、交互设计和技术实现

---

## 📋 文档概览

本文档详细说明了 **EF-04 增强型数据导出** 功能的两种 UI 方案：
1. **方案 A**：分步式卡片选择（推荐）
2. **方案 B**：下拉框快速选择（紧凑）

同时提供完整的交互逻辑、代码实现和用户体验分析。

---

## 🎨 方案 A: 分步式卡片选择（推荐）

### 界面结构

```
┌─────────────────────────────────────────────────────┐
│  📥 Export Conversations                            │
│  Choose your export options step by step            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [1] Step 1: Choose Export Mode                    │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │ 📦 Multiple Files│  │ 🔗 Single Document│       │
│  │                  │  │                   │       │
│  │ Export each      │  │ Merge all        │       │
│  │ conversation as  │  │ conversations    │       │
│  │ separate file    │  │ into one file    │       │
│  │                  │  │                   │       │
│  │ ⦿ Selected       │  │ ○                │       │
│  └──────────────────┘  └──────────────────┘        │
│                                                     │
│  [2] Step 2: Choose File Format                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │📝 MD    │  │📄 TXT   │  │📊 JSON  │            │
│  │         │  │         │  │         │            │
│  │.md      │  │.txt     │  │.json    │            │
│  │format   │  │format   │  │format   │            │
│  │         │  │         │  │         │            │
│  │Best for │  │Universal│  │For devs,│            │
│  │Notion,  │  │compat.  │  │data     │            │
│  │Obsidian │  │         │  │analysis │            │
│  │         │  │         │  │         │            │
│  │    ⦿    │  │    ○    │  │    ○    │            │
│  └─────────┘  └─────────┘  └─────────┘            │
│                                                     │
│  📋 Export Preview                                  │
│  ┌─────────────────────────────────────────────┐   │
│  │ • Mode: Multiple Files                      │   │
│  │ • Format: Markdown (.md)                    │   │
│  │ • Conversations: 51                         │   │
│  │ • Output: 51 files in .zip                  │   │
│  │ • Estimated size: ~2.5 MB                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [📥 Start Export]  [Cancel]                       │
└─────────────────────────────────────────────────────┘
```

### 设计特点

**✅ 优点**：
1. **视觉清晰**：每个选项都有独立的卡片，信息层次分明
2. **易于理解**：图标 + 标题 + 描述，用户一眼就能看懂
3. **决策辅助**：每个选项都有使用场景说明，帮助用户做出正确选择
4. **状态明确**：单选按钮清楚显示当前选择
5. **实时反馈**：Preview 区域实时显示导出预览

**❌ 缺点**：
1. **占用空间大**：需要较大的垂直空间
2. **步骤较多**：需要点击两次才能完成选择
3. **不适合频繁操作**：如果用户经常导出，重复操作会略显繁琐

**🎯 适用场景**：
- 首次使用的用户
- 需要详细了解每个选项的用户
- 不常使用导出功能的用户
- 屏幕空间充足的场景

---

## 🎨 方案 B: 下拉框快速选择（紧凑）

### 界面结构

```
┌─────────────────────────────────────────────────────┐
│  📥 Export Conversations                            │
│  Configure your export settings                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Export Mode                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📦 Export Multiple Files                ▼  │   │
│  │ Each conversation will be exported as       │   │
│  │ a separate file                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  File Format                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📝 Markdown (.md)                       ▼  │   │
│  │ Best for Notion, Obsidian, and other        │   │
│  │ markdown editors                            │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  📋 Export Preview                                  │
│  ┌─────────────────────────────────────────────┐   │
│  │ • Mode: Multiple Files                      │   │
│  │ • Format: Markdown (.md)                    │   │
│  │ • Conversations: 51                         │   │
│  │ • Output: 51 files in .zip                  │   │
│  │ • Estimated size: ~2.5 MB                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [📥 Start Export]  [Cancel]                       │
└─────────────────────────────────────────────────────┘
```

### 下拉菜单展开状态

```
┌─────────────────────────────────────────────────────┐
│  Export Mode                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ ⦿ 📦 Export Multiple Files              ▲  │   │
│  │   Each conversation as separate file        │   │
│  ├─────────────────────────────────────────────┤   │
│  │ ○ 🔗 Merge into One Document                │   │
│  │   All conversations in one file             │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  File Format                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ ⦿ 📝 Markdown (.md)                     ▲  │   │
│  │   Best for Notion, Obsidian              │   │
│  ├─────────────────────────────────────────────┤   │
│  │ ○ 📄 Plain Text (.txt)                      │   │
│  │   Universal compatibility                   │   │
│  ├─────────────────────────────────────────────┤   │
│  │ ○ 📊 JSON (.json)                           │   │
│  │   For developers, data analysis             │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 设计特点

**✅ 优点**：
1. **紧凑高效**：占用空间小，适合侧边栏
2. **操作快速**：熟悉后可以快速完成选择
3. **符合习惯**：下拉框是常见的 UI 模式
4. **易于扩展**：后续添加新选项容易

**❌ 缺点**：
1. **信息隐藏**：其他选项需要点击才能看到
2. **学习成本**：首次使用需要探索
3. **视觉层次弱**：不如卡片式直观

**🎯 适用场景**：
- 熟悉产品的老用户
- 频繁使用导出功能的用户
- 屏幕空间有限的场景
- 需要快速操作的场景

---

## 🔄 完整交互流程

### 方案 A 的交互流程

```
1. 用户打开导出面板
   ↓
2. 默认状态：所有选项都未选中，"Start Export" 按钮禁用
   ↓
3. 用户点击 "Multiple Files" 卡片
   ↓
4. 卡片高亮，单选按钮变为选中状态
   ↓
5. "Start Export" 按钮仍然禁用（因为还没选格式）
   ↓
6. 用户点击 "Markdown" 卡片
   ↓
7. 卡片高亮，单选按钮变为选中状态
   ↓
8. Preview 区域自动更新显示：
   • Mode: Multiple Files
   • Format: Markdown (.md)
   • Conversations: 51
   • Output: 51 files in conversations_2024-12-07.zip
   • Estimated size: ~2.5 MB
   ↓
9. "Start Export" 按钮激活（变为蓝色可点击状态）
   ↓
10. 用户点击 "Start Export"
    ↓
11. 显示进度提示：
    "⏳ Exporting 51 conversations... (12/51)"
    ↓
12. 导出完成：
    "✅ Successfully exported 51 conversations!"
    下载对话框弹出
    ↓
13. 用户保存文件
```

### 方案 B 的交互流程

```
1. 用户打开导出面板
   ↓
2. 默认状态：
   • Export Mode: 显示占位文字 "Select export mode"
   • File Format: 显示占位文字 "Select file format"
   • "Start Export" 按钮禁用（灰色）
   ↓
3. 用户点击 "Export Mode" 下拉框
   ↓
4. 下拉菜单展开，显示两个选项：
   ○ 📦 Export Multiple Files
   ○ 🔗 Merge into One Document
   ↓
5. 用户选择 "Export Multiple Files"
   ↓
6. 下拉框收起，显示选中值和描述：
   📦 Export Multiple Files
   Each conversation will be exported as a separate file
   ↓
7. "Start Export" 按钮仍然禁用
   ↓
8. 用户点击 "File Format" 下拉框
   ↓
9. 下拉菜单展开，显示三个选项：
   ○ 📝 Markdown (.md)
   ○ 📄 Plain Text (.txt)
   ○ 📊 JSON (.json)
   ↓
10. 用户选择 "Markdown (.md)"
    ↓
11. 下拉框收起，显示选中值和描述
    ↓
12. Preview 区域自动更新
    ↓
13. "Start Export" 按钮激活
    ↓
14. 用户点击 "Start Export"
    ↓
15. 后续流程同方案 A
```

---

## 💻 技术实现

### 方案 A 的实现代码

```tsx
// ExportPanelOptionA.tsx
import React, { useState, useEffect } from 'react';
import './ExportPanel.css';

type ExportMode = 'multiple-files' | 'single-document' | null;
type ExportFormat = 'markdown' | 'txt' | 'json' | null;

interface ModeOption {
  id: ExportMode;
  icon: string;
  title: string;
  description: string;
}

interface FormatOption {
  id: ExportFormat;
  icon: string;
  title: string;
  format: string;
  description: string;
}

const ExportPanelOptionA: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<ExportMode>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // 模式选项
  const modeOptions: ModeOption[] = [
    {
      id: 'multiple-files',
      icon: '📦',
      title: 'Multiple Files',
      description: 'Export each conversation as a separate file'
    },
    {
      id: 'single-document',
      icon: '🔗',
      title: 'Single Document',
      description: 'Merge all conversations into one file'
    }
  ];
  
  // 格式选项
  const formatOptions: FormatOption[] = [
    {
      id: 'markdown',
      icon: '📝',
      title: 'Markdown',
      format: '.md format',
      description: 'Best for Notion, Obsidian'
    },
    {
      id: 'txt',
      icon: '📄',
      title: 'Plain Text',
      format: '.txt format',
      description: 'Universal compatibility'
    },
    {
      id: 'json',
      icon: '📊',
      title: 'JSON',
      format: '.json format',
      description: 'For developers, data analysis'
    }
  ];
  
  // 检查是否可以导出
  const canExport = selectedMode !== null && selectedFormat !== null;
  
  // 处理导出
  const handleExport = async () => {
    if (!canExport) return;
    
    setIsExporting(true);
    
    try {
      // 调用导出逻辑
      await performExport(selectedMode!, selectedFormat!);
      alert('✅ Export completed successfully!');
    } catch (error) {
      alert('❌ Export failed: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <div className="export-panel option-a">
      {/* 标题 */}
      <header className="panel-header">
        <h2>📥 Export Conversations</h2>
        <p>Choose your export options step by step</p>
      </header>
      
      {/* Step 1: 模式选择 */}
      <section className="export-step">
        <div className="step-header">
          <div className="step-number">1</div>
          <h3>Step 1: Choose Export Mode</h3>
        </div>
        
        <div className="mode-cards">
          {modeOptions.map(option => (
            <ModeCard
              key={option.id}
              option={option}
              selected={selectedMode === option.id}
              onSelect={() => setSelectedMode(option.id)}
            />
          ))}
        </div>
      </section>
      
      {/* Step 2: 格式选择 */}
      <section className="export-step">
        <div className="step-header">
          <div className="step-number">2</div>
          <h3>Step 2: Choose File Format</h3>
        </div>
        
        <div className="format-cards">
          {formatOptions.map(option => (
            <FormatCard
              key={option.id}
              option={option}
              selected={selectedFormat === option.id}
              onSelect={() => setSelectedFormat(option.id)}
            />
          ))}
        </div>
      </section>
      
      {/* 预览区域 */}
      {canExport && (
        <section className="export-preview">
          <h3>📋 Export Preview</h3>
          <ExportPreview 
            mode={selectedMode!}
            format={selectedFormat!}
          />
        </section>
      )}
      
      {/* 操作按钮 */}
      <footer className="panel-footer">
        <button
          className="btn-primary"
          onClick={handleExport}
          disabled={!canExport || isExporting}
        >
          {isExporting ? '⏳ Exporting...' : '📥 Start Export'}
        </button>
        <button className="btn-secondary">
          Cancel
        </button>
      </footer>
    </div>
  );
};

// 模式卡片组件
const ModeCard: React.FC<{
  option: ModeOption;
  selected: boolean;
  onSelect: () => void;
}> = ({ option, selected, onSelect }) => {
  return (
    <div 
      className={`mode-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="card-icon">{option.icon}</div>
      <h4 className="card-title">{option.title}</h4>
      <p className="card-description">{option.description}</p>
      
      <div className="card-radio">
        <input 
          type="radio" 
          checked={selected}
          readOnly
        />
        <span>{selected ? 'Selected' : ''}</span>
      </div>
    </div>
  );
};

// 格式卡片组件
const FormatCard: React.FC<{
  option: FormatOption;
  selected: boolean;
  onSelect: () => void;
}> = ({ option, selected, onSelect }) => {
  return (
    <div 
      className={`format-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="card-icon">{option.icon}</div>
      <h4 className="card-title">{option.title}</h4>
      <p className="card-format">{option.format}</p>
      <p className="card-description">{option.description}</p>
      
      <div className="card-radio">
        <input 
          type="radio" 
          checked={selected}
          readOnly
        />
      </div>
    </div>
  );
};

// 预览组件
const ExportPreview: React.FC<{
  mode: ExportMode;
  format: ExportFormat;
}> = ({ mode, format }) => {
  const conversationCount = 51; // 从实际数据获取
  
  const modeText = mode === 'multiple-files' 
    ? 'Multiple Files (Each conversation = 1 file)'
    : 'Single Document (All conversations merged)';
  
  const formatText = {
    'markdown': 'Markdown (.md)',
    'txt': 'Plain Text (.txt)',
    'json': 'JSON (.json)'
  }[format!];
  
  const outputText = mode === 'multiple-files'
    ? `${conversationCount} files packaged in conversations_${new Date().toISOString().split('T')[0]}.zip`
    : `1 file: conversations_${new Date().toISOString().split('T')[0]}.${format}`;
  
  return (
    <div className="preview-box">
      <ul className="preview-list">
        <li>• Mode: {modeText}</li>
        <li>• Format: {formatText}</li>
        <li>• Conversations: {conversationCount}</li>
        <li>• Output: {outputText}</li>
        <li>• Estimated size: ~2.5 MB</li>
      </ul>
    </div>
  );
};

// 导出逻辑（实际实现）
async function performExport(
  mode: ExportMode,
  format: ExportFormat
): Promise<void> {
  // 获取对话数据
  const conversations = await getAllConversations();
  
  if (mode === 'multiple-files') {
    // 多文件模式
    await exportMultipleFiles(conversations, format);
  } else {
    // 单文件模式
    await exportSingleDocument(conversations, format);
  }
}

export default ExportPanelOptionA;
```

### 方案 B 的实现代码

```tsx
// ExportPanelOptionB.tsx
import React, { useState } from 'react';
import './ExportPanel.css';

interface DropdownOption {
  value: string;
  icon: string;
  label: string;
  description: string;
}

const ExportPanelOptionB: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // 模式选项
  const modeOptions: DropdownOption[] = [
    {
      value: 'multiple-files',
      icon: '📦',
      label: 'Export Multiple Files',
      description: 'Each conversation will be exported as a separate file'
    },
    {
      value: 'single-document',
      icon: '🔗',
      label: 'Merge into One Document',
      description: 'All conversations will be merged into one file'
    }
  ];
  
  // 格式选项
  const formatOptions: DropdownOption[] = [
    {
      value: 'markdown',
      icon: '📝',
      label: 'Markdown (.md)',
      description: 'Best for Notion, Obsidian, and other markdown editors'
    },
    {
      value: 'txt',
      icon: '📄',
      label: 'Plain Text (.txt)',
      description: 'Universal compatibility, works everywhere'
    },
    {
      value: 'json',
      icon: '📊',
      label: 'JSON (.json)',
      description: 'For developers and data analysis'
    }
  ];
  
  const canExport = selectedMode !== null && selectedFormat !== null;
  
  const handleExport = async () => {
    if (!canExport) return;
    
    setIsExporting(true);
    try {
      await performExport(selectedMode!, selectedFormat!);
      alert('✅ Export completed!');
    } catch (error) {
      alert('❌ Export failed: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <div className="export-panel option-b">
      {/* 标题 */}
      <header className="panel-header">
        <h2>📥 Export Conversations</h2>
        <p>Configure your export settings</p>
      </header>
      
      {/* 模式选择 */}
      <section className="export-section">
        <label>Export Mode</label>
        <CustomDropdown
          options={modeOptions}
          selected={selectedMode}
          onSelect={setSelectedMode}
          placeholder="Select export mode"
        />
      </section>
      
      {/* 格式选择 */}
      <section className="export-section">
        <label>File Format</label>
        <CustomDropdown
          options={formatOptions}
          selected={selectedFormat}
          onSelect={setSelectedFormat}
          placeholder="Select file format"
        />
      </section>
      
      {/* 预览 */}
      {canExport && (
        <section className="export-preview">
          <h3>📋 Export Preview</h3>
          <ExportPreview 
            mode={selectedMode!}
            format={selectedFormat!}
          />
        </section>
      )}
      
      {/* 操作按钮 */}
      <footer className="panel-footer">
        <button
          className="btn-primary"
          onClick={handleExport}
          disabled={!canExport || isExporting}
        >
          {isExporting ? '⏳ Exporting...' : '📥 Start Export'}
        </button>
        <button className="btn-secondary">Cancel</button>
      </footer>
    </div>
  );
};

// 自定义下拉组件
const CustomDropdown: React.FC<{
  options: DropdownOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  placeholder: string;
}> = ({ options, selected, onSelect, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedOption = options.find(opt => opt.value === selected);
  
  return (
    <div className="custom-dropdown">
      {/* 下拉框触发器 */}
      <button 
        className="dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="trigger-content">
          {selectedOption ? (
            <>
              <span className="trigger-icon">{selectedOption.icon}</span>
              <div className="trigger-text">
                <div className="trigger-label">{selectedOption.label}</div>
                <div className="trigger-description">{selectedOption.description}</div>
              </div>
            </>
          ) : (
            <span className="trigger-placeholder">{placeholder}</span>
          )}
        </div>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      
      {/* 下拉菜单 */}
      {isOpen && (
        <div className="dropdown-menu">
          {options.map(option => (
            <div
              key={option.value}
              className={`dropdown-option ${selected === option.value ? 'selected' : ''}`}
              onClick={() => {
                onSelect(option.value);
                setIsOpen(false);
              }}
            >
              <input 
                type="radio"
                checked={selected === option.value}
                readOnly
              />
              <span className="option-icon">{option.icon}</span>
              <div className="option-text">
                <div className="option-label">{option.label}</div>
                <div className="option-description">{option.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportPanelOptionB;
```

### 共享样式

```css
/* ExportPanel.css */

.export-panel {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
  max-width: 600px;
}

/* 标题区域 */
.panel-header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 16px;
  margin-bottom: 24px;
}

.panel-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.panel-header p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

/* ==================== 方案 A 样式 ==================== */

.option-a .export-step {
  margin-bottom: 32px;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #2563eb;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.step-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

/* 模式卡片 */
.mode-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.mode-card {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.mode-card:hover {
  border-color: #2563eb;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
}

.mode-card.selected {
  border-color: #2563eb;
  background: #eff6ff;
}

.mode-card .card-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.mode-card .card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.mode-card .card-description {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0 0 16px 0;
}

.mode-card .card-radio {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #2563eb;
}

/* 格式卡片 */
.format-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.format-card {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.format-card:hover {
  border-color: #2563eb;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
}

.format-card.selected {
  border-color: #2563eb;
  background: #eff6ff;
}

.format-card .card-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.format-card .card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 4px 0;
}

.format-card .card-format {
  font-size: 11px;
  color: #6b7280;
  margin: 0 0 8px 0;
}

.format-card .card-description {
  font-size: 11px;
  color: #6b7280;
  line-height: 1.4;
  margin: 0 0 12px 0;
}

/* ==================== 方案 B 样式 ==================== */

.option-b .export-section {
  margin-bottom: 24px;
}

.export-section label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}

/* 自定义下拉框 */
.custom-dropdown {
  position: relative;
}

.dropdown-trigger {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.2s;
}

.dropdown-trigger:hover {
  border-color: #2563eb;
}

.trigger-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.trigger-icon {
  font-size: 18px;
}

.trigger-text {
  text-align: left;
}

.trigger-label {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
}

.trigger-description {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.trigger-placeholder {
  font-size: 14px;
  color: #9ca3af;
}

.dropdown-arrow {
  color: #6b7280;
  font-size: 12px;
}

/* 下拉菜单 */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-option:hover {
  background: #f3f4f6;
}

.dropdown-option.selected {
  background: #eff6ff;
}

.dropdown-option input[type="radio"] {
  margin: 0;
}

.option-icon {
  font-size: 18px;
}

.option-text {
  flex: 1;
}

.option-label {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
}

.option-description {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

/* ==================== 共享样式 ==================== */

/* 预览区域 */
.export-preview {
  margin: 24px 0;
}

.export-preview h3 {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 12px 0;
}

.preview-box {
  background: #eff6ff;
  border: 2px solid #2563eb;
  border-radius: 8px;
  padding: 16px;
}

.preview-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.preview-list li {
  font-size: 13px;
  color: #1f2937;
  padding: 6px 0;
  border-bottom: 1px solid rgba(37, 99, 235, 0.1);
}

.preview-list li:last-child {
  border-bottom: none;
}

/* 操作按钮 */
.panel-footer {
  display: flex;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.btn-primary {
  flex: 1;
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
  transform: none;
}

.btn-secondary {
  padding: 12px 24px;
  background: white;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}
```

---

## 📊 方案对比表

| 对比维度 | 方案 A (卡片式) | 方案 B (下拉式) | 推荐 |
|---------|----------------|----------------|------|
| **视觉清晰度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | A |
| **空间占用** | ⭐⭐ | ⭐⭐⭐⭐⭐ | B |
| **操作效率** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | B |
| **学习成本** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | A |
| **可扩展性** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | B |
| **首次使用体验** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | A |
| **频繁使用体验** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | B |
| **信息层次** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | A |
| **开发复杂度** | ⭐⭐⭐ | ⭐⭐⭐⭐ | B |

---

## 🎯 最终推荐

### 综合推荐：**方案 A（分步式卡片选择）**

**推荐理由**：
1. **用户友好**：适合首次使用的用户，学习成本低
2. **决策支持**：每个选项都有清晰的说明，帮助用户做出正确选择
3. **视觉吸引力**：卡片式设计更现代、更美观
4. **符合趋势**：现代 Web 应用更倾向于使用卡片式布局

**适用场景**：
- MVP 阶段
- 用户第一次使用
- 需要强调功能细节
- 屏幕空间充足（侧边栏宽度 > 400px）

### 折衷方案：**混合模式**

可以结合两种方案的优点：
1. **默认使用方案 A**（卡片式）
2. **提供"紧凑模式"切换**，让熟悉的用户选择方案 B（下拉式）
3. **保存用户偏好**，下次打开时自动使用用户喜欢的模式

```tsx
const ExportPanel: React.FC = () => {
  const [compactMode, setCompactMode] = useState(
    localStorage.getItem('export-compact-mode') === 'true'
  );
  
  const toggleCompactMode = () => {
    const newMode = !compactMode;
    setCompactMode(newMode);
    localStorage.setItem('export-compact-mode', String(newMode));
  };
  
  return (
    <div className="export-panel">
      {/* 模式切换按钮 */}
      <button 
        className="compact-toggle"
        onClick={toggleCompactMode}
        title={compactMode ? 'Switch to card view' : 'Switch to compact view'}
      >
        {compactMode ? '📋' : '📦'}
      </button>
      
      {/* 根据模式渲染不同组件 */}
      {compactMode ? (
        <ExportPanelOptionB />
      ) : (
        <ExportPanelOptionA />
      )}
    </div>
  );
};
```

---

## 🔄 导出逻辑流程图说明

PDF 中的第三页展示了完整的导出逻辑流程：

```
┌─────────────────────┐
│ 1. User Selects     │ ← 用户选择模式和格式
│    Mode + Format    │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 2. System Validates │ ← 系统验证是否都选了
│    Both selected?   │
└──────────┬──────────┘
           ↓
    ┌──────┴──────┐
    ↓             ↓
┌────────┐  ┌────────┐
│3a.Multi│  │3b.Single│ ← 根据模式分支
│ Files  │  │Document│
└───┬────┘  └───┬────┘
    ↓           ↓
┌────────┐  ┌────────┐
│4a.Format│  │4b.Format│ ← 转换为指定格式
│Convert │  │Convert │
└───┬────┘  └───┬────┘
    └──────┬──────┘
           ↓
┌─────────────────────┐
│ 5. Download File    │ ← 用户下载文件
│    User saves       │
└─────────────────────┘
```

---

## 📝 总结

1. **方案 A**：适合新用户，视觉清晰，学习成本低
2. **方案 B**：适合老用户，操作快速，空间紧凑
3. **推荐**：优先实现方案 A，后期可添加紧凑模式切换
4. **技术**：两种方案都已提供完整的实现代码
5. **体验**：都提供实时预览和禁用按钮验证

根据你的项目情况选择最合适的方案！如果需要进一步调整设计或代码，随时告诉我。
