# Chat Memo Pro

A powerful Chrome extension for capturing, organizing, and exporting conversations from multiple AI chat platforms.

## Features

### Core Capabilities
- **Auto-Save Conversations**: Automatically saves your AI chat conversations to local storage
- **Cross-Platform Support**: Works with 9 major AI platforms (see below)
- **Smart Organization**: Manages conversations with timestamps, titles, and metadata
- **Incremental Sync**: Efficiently updates conversations without duplicating data

### Advanced Search
- **Fuzzy Search**: Find conversations even with typos using Fuse.js
- **Keyword Highlighting**: Search terms highlighted in yellow for easy scanning
- **Typo Tolerance**: Smart matching across titles, content, and platform names
- **Real-time Results**: Instant search feedback as you type

### Export Wizard
- **3-Step Process**: Intuitive wizard for time range → mode → format selection
- **Flexible Time Ranges**: Export all, last week, month, 3 months, year, or custom date range
- **Multiple Formats**: Markdown (.md), JSON, or Plain Text (.txt)
- **Export Modes**:
  - Single merged file for all conversations
  - Multiple files packaged as ZIP archive
- **YAML Frontmatter**: Markdown exports include metadata headers
- **Size Warnings**: Alerts for large exports (>100MB) before processing
- **Real-time Preview**: Shows conversation count and estimated file size

### Resizable Sidebar
- **Drag-to-Resize**: Adjust sidebar width (320px - 800px) via left edge handle
- **Persistent Width**: Remembers your preferred width in localStorage
- **Responsive Layout**: Adapts content display based on width
  - Narrow mode (<450px): Vertical stats, 1-line preview
  - Wide mode (≥450px): Horizontal stats, 2-line preview
  - Very wide (>600px): 3-line preview
- **Visual Feedback**: Handle highlights on hover, shows width tooltip during resize

## Supported Platforms

1. ChatGPT (chat.openai.com)
2. Claude (claude.ai)
3. Gemini (gemini.google.com)
4. Perplexity (perplexity.ai)
5. Kimi (kimi.ai)
6. DeepSeek (chat.deepseek.com)
7. Doubao (doubao.com)
8. **Manus** (manus.im) - _New!_ Heuristic text analysis
9. **Genspark** (genspark.ai) - _New!_ Fallback selector strategy

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the `chat-memo-pro` directory
5. The extension icon will appear in your toolbar

## Usage

1. Visit any supported AI chat platform
2. Start or continue a conversation
3. Conversations are automatically saved (if auto-save is enabled)
4. Click the extension icon to:
   - View all saved conversations
   - Search using fuzzy matching
   - Export conversations via the wizard
   - Resize the sidebar to your preference



##  **📁 如何在 Mac 本地找到存储文件**



####  **方法 1: 使用 Chrome DevTools（推荐）**



 这是最简单的方法，可以直接查看和管理数据：



1. **打开扩展侧边栏**
2. **右键点击侧边栏** → 选择 "检查" (Inspect)
3. **在 DevTools 中**：

  \- 点击 **Application** 标签

  \- 左侧展开 **IndexedDB**

  \- 找到 KeepAIMemoryDB

  \- 点击 conversations 可以查看所有对话数据



####  **方法 2: 在文件系统中查找**

 **步骤 1: 找到扩展 ID**

1. 打开 chrome://extensions/
2. 打开 "开发者模式"
3. 找到 "Chat Memo Pro"，复制 **ID**（例如：gefpcelbgaofbnehfglgibacfejejflp）



 **步骤 2: 打开存储位置**

1. 打开 **Finder**
2. 按 Cmd + Shift + G（前往文件夹）
3. 输入以下路径：

 `~/Library/Application Support/Google/Chrome/Default/IndexedDB/`

4. 找到文件夹：`chrome-extension_<你的扩展ID>_0.indexeddb.leveldb/`



 **示例路径**：

` ~/Library/Application Support/Google/Chrome/Default/IndexedDB/chrome-extension_gefpcelbgaofbnehfglgibacfejejflp_0.indexeddb.leveldb/`



####  **方法 3: 使用终端命令**

 \# 1. 查看所有扩展的 IndexedDB

` ls -la ~/Library/Application\ Support/Google/Chrome/Default/IndexedDB/`



 \# 2. 查找包含 "chrome-extension" 的文件夹

` ls ~/Library/Application\ Support/Google/Chrome/Default/IndexedDB/ | grep chrome-extension`



 \# 3. 查看特定扩展的文件

 `ls -lh ~/Library/Application\Support/Google/Chrome/Default/IndexedDB/chrome-extension_<扩展ID>_0.indexeddb.leveldb/`



####  **⚠️ 重要提示**



1. **IndexedDB 是二进制格式**：

  \- 文件以 LevelDB 格式存储，无法用文本编辑器直接打开

  \- 推荐使用 Chrome DevTools 查看内容

2. **备份建议**：

  \- 使用扩展的 **Export Wizard** 功能导出数据

  \- 支持 Markdown、JSON、Plain Text 格式

  \- 更安全、更可读

3. **如果要备份原始数据库**：

 \# 复制整个数据库文件夹到备份位置

 `cp -r ~/Library/Application Support/Google/Chrome/Default/IndexedDB/chrome-extension_<扩展ID>_0.indexeddb.leveldb/ ~/Desktop/chat-memo-backup/`



---

# Debugging Guide

This section provides instructions and a JavaScript snippet to help debug the Chat Memo Chrome extension, especially for newly added platform adapters or when auto-saving isn't working as expected.

## Enabling Debugging on a Specific Page

1.  **Load the Modified Extension:** Ensure the latest version of the Chat Memo extension (with any recent code changes) is loaded into your Chrome browser.
2.  **Navigate to the Target Page:** Go to the AI chat platform page you wish to debug (e.g., Manus.im or Genspark.ai).
3.  **Open Developer Tools:** Open your browser's Developer Tools (usually by pressing `F12`, `Ctrl+Shift+I`, or right-clicking on the page and selecting "Inspect").
4.  **Go to the Console Tab:** Select the "Console" tab within the Developer Tools.
5.  **Paste the Debugging Script:** Copy the entire JavaScript code block below and paste it into the console. Press `Enter` to execute.

    ```javascript
    (function() {
        console.groupCollapsed('Chat Memo Debugger');
    
        const isContentScriptLoaded = typeof window.keepAIMemoryCommon !== 'undefined';
        const AdapterInstance = window.AdapterInstance;
    
        if (!isContentScriptLoaded) {
            console.warn('Chat Memo content script (content_common.js) not detected. Some debugging features may be unavailable.');
        }
    
        if (!AdapterInstance || !(AdapterInstance instanceof BasePlatformAdapter)) {
            console.error('Chat Memo adapter instance not found or not a BasePlatformAdapter. Ensure you are on a supported AI chat page, and the adapter is correctly initializing and setting `window.AdapterInstance`.');
            console.groupEnd();
            return;
        }
    
        const globalSettings = window.keepAIMemorySettings;
        if (!globalSettings) {
            console.warn('`window.keepAIMemorySettings` not found. Auto-save status and settings might not be accurate. Ensure content_common.js loaded correctly.');
        }
    
        console.log('Chat Memo Debugger Loaded. Type `cmDebug` to access commands.');
    
        const cmDebug = {
            adapter: AdapterInstance,
            settings: globalSettings,
    
            status: function() {
                console.log('--- Chat Memo Status ---');
                console.log('Platform:', this.adapter.platform);
                console.log('Current URL:', window.location.href);
                console.log('Is valid conversation URL?', this.adapter.isValidConversationUrl(window.location.href));
                console.log('Conversation ID:', this.adapter.currentConversationId);
                console.log('Auto-Save Enabled:', this.settings ? this.settings.autoSave : 'N/A (settings not loaded)');
                console.log('Last Extracted Content (Manus/Genspark):', this.adapter.lastExtractedContent || 'N/A');
                console.log('------------------------');
            },
    
            getMessages: function() {
                console.log('--- Extracted Messages ---');
                const messages = this.adapter.extractMessages();
                if (messages && messages.length > 0) {
                    messages.forEach((msg, index) => {
                        console.log(`[${index}] Role: ${msg.role}, Content: "${msg.content.substring(0, 100)}"...`);
                    });
                    console.log(`Total messages extracted: ${messages.length}`);
                } else {
                    console.warn('No messages extracted. Check adapter\'s `extractMessages` logic.');
                }
                return messages;
            },
    
            getTitle: function() {
                console.log('--- Extracted Title ---');
                const title = this.adapter.extractTitle();
                console.log('Title:', title || 'No title extracted.');
                return title;
            },
    
            forceSave: async function() {
                console.log('--- Forcing Save Operation ---');
                if (!this.adapter.currentConversationId) {
                    console.warn('No conversation ID. Attempting to find or create a conversation first.');
                    await this.adapter.findOrCreateConversation();
                }
                if (this.adapter.currentConversationId) {
                    try {
                        const result = await this.adapter.performIncrementalSave();
                        console.log('Force save successful:', result);
                        if (window.keepAIMemoryCommon && typeof window.keepAIMemoryCommon.showSuccessStatus === 'function') {
                            window.keepAIMemoryCommon.showSuccessStatus();
                        }
                    } catch (error) {
                        console.error('Force save failed:', error);
                    }
                } else {
                    console.error('Could not obtain a conversation ID. Save failed.');
                }
            },
    
            toggleAutoSave: async function() {
                if (!this.settings) {
                    console.error('Cannot toggle auto-save: Global settings not loaded.');
                    return;
                }
                const currentAutoSave = this.settings.autoSave;
                const newAutoSave = !currentAutoSave;
                console.log(`--- Toggling Auto-Save: ${currentAutoSave} -> ${newAutoSave} ---`);
                try {
                    this.settings.autoSave = newAutoSave;
                    await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage({
                            type: 'updateSettings',
                            settings: { autoSave: newAutoSave }
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                reject(chrome.runtime.lastError);
                            } else {
                                resolve(response);
                            }
                        });
                    });
                    console.log(`Auto-Save is now ${newAutoSave ? 'ENABLED' : 'DISABLED'}.`);
                    if (window.keepAIMemory && typeof window.keepAIMemory.updateSettings === 'function') {
                        window.keepAIMemory.updateSettings(this.settings);
                    }
                } catch (error) {
                    console.error('Failed to toggle auto-save:', error);
                }
            },
    
            triggerMutation: function() {
                console.log('--- Manually triggering DOM mutation handling ---');
                if (typeof this.adapter.handleMutation === 'function') {
                    this.adapter.handleMutation();
                    console.log('Mutation handler executed. Check console for further logs.');
                } else {
                    console.warn('`handleMutation` method not found on adapter. This feature might not be available for this adapter.');
                }
            },
    
            reinitializeAdapter: function() {
                console.log('--- Reinitializing Adapter ---');
                if (window.keepAIMemory && typeof window.keepAIMemory.resetInitialization === 'function') {
                    window.keepAIMemory.resetInitialization();
                    console.log('Content script initialization state reset.');
                } else {
                    console.warn('`window.keepAIMemory.resetInitialization` not found. Manual page refresh may be needed.');
                }
                this.adapter.start();
                console.log('Adapter `start()` method called.');
            }
        };
    
        window.cmDebug = cmDebug;
        console.log('`cmDebug` object is available in the console for debugging. Try `cmDebug.status()`');
        console.groupEnd();
    })();
    ```

## Debugging Commands

Once the debugger is loaded, you can use the `cmDebug` object in the console to run various commands:

*   **`cmDebug.status()`**: Displays the current state of the adapter, including the platform, current URL, conversation ID, and auto-save status.
*   **`cmDebug.getMessages()`**: Executes the `extractMessages()` method of the active adapter and logs the messages it detects on the page. This is crucial for verifying if the adapter's selectors and parsing logic are correctly identifying chat content.
*   **`cmDebug.getTitle()`**: Executes the `extractTitle()` method to show what title the adapter is generating for the current conversation.
*   **`cmDebug.forceSave()`**: Manually triggers the saving process. Useful for testing the persistence flow independently of auto-save triggers.
*   **`cmDebug.toggleAutoSave()`**: Toggles the auto-save setting on or off for the extension.
*   **`cmDebug.triggerMutation()`**: Manually calls the adapter's `handleMutation()` method, simulating a DOM change. This helps debug the `MutationObserver` logic.
*   **`cmDebug.reinitializeAdapter()`**: Resets and restarts the active adapter. This can be helpful if you've navigated within a Single-Page Application (SPA) and suspect the adapter hasn't re-initialized correctly.

By using these commands, you can inspect the internal workings of the extension and pinpoint issues related to URL matching, message extraction, or saving mechanisms.
