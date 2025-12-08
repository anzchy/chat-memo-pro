# Chat Memo Debugging Guide

This guide provides instructions and a JavaScript snippet to help debug the Chat Memo Chrome extension, especially for newly added platform adapters or when auto-saving isn't working as expected.

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
