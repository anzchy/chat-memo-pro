# Chat Memo Pro

A powerful Chrome extension for capturing, organizing, and exporting conversations from multiple AI chat platforms.

![image-20251214091101760](https://picbox-1313243162.cos.ap-nanjing.myqcloud.com/typora/image-20251214091101760.png)

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
   - Sync conversations to the cloud (optional)

## Cloud Sync

**NEW in v1.3.0**: Synchronize your conversations across devices using Supabase backend.

### Features
- **Cross-Device Sync**: Access your conversations from any device
- **Two-Way Sync**: Automatically syncs local changes to cloud and vice versa
- **Auto-Sync**: Schedule automatic syncs (5-1440 minutes interval)
- **Conflict Resolution**: Last-Write-Wins (LWW) strategy for handling conflicts
- **Account Switch Detection**: Automatically resets sync when switching Supabase accounts
- **Retry Mechanism**: Automatically retries failed uploads
- **Detailed Status**: Real-time sync status, history, and progress tracking

### Quick Setup

#### 1. **Create a Supabase Project**

   a. Visit [supabase.com](https://supabase.com) and create a free account (if you don't have one)

   b. Click **"New Project"** and fill in:
      - Project name (e.g., "chat-memo-sync")
      - Database password (save this - you'll need it for database management)
      - Region (choose closest to you)

   c. Wait for project setup to complete (~2 minutes)

#### 2. **Get Your Project Credentials**

   a. **Find Project URL**:
      - In your Supabase dashboard, click on your project
      - Go to **Settings** (gear icon in left sidebar) → **API**
      - Under "Project URL" section, copy the URL
      - Example: `https://abcdefghijklmnop.supabase.co`

   b. **Find Anon/Public API Key**:
      - Same page (**Settings** → **API**)
      - Under "Project API keys" section
      - Copy the **`anon` `public`** key (NOT the `service_role` key)
      - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### 3. **Create Authentication User**

   > ⚠️ **IMPORTANT**: This email/password is for the extension to sign in, NOT your Supabase account login!

   a. In Supabase dashboard, go to **Authentication** (left sidebar) → **Users**

   b. Click **"Add user"** → Select **"Create new user"**

   c. Fill in:
      - **Email**: Your email (can be same as Supabase account or different)
      - **Password**: Create a strong password (this is what you'll use in the extension)
      - Leave "Auto Confirm User" checked

   d. Click **"Create user"**

   e. **Save these credentials** - you'll need them in step 5!

#### 4. **Run Database Migration**

   a. In Supabase dashboard, go to **SQL Editor** (left sidebar)

   b. Click **"New query"**

   c. Copy and paste the entire content from `specs/002-cloud-sync/supabase/migration.sql`

   d. Click **"Run"** (or press `Cmd/Ctrl + Enter`)

   e. Verify success: You should see "Success. No rows returned" message

   f. Confirm tables created:
      - Go to **Table Editor** (left sidebar)
      - You should see `conversations` and `messages` tables

#### 5. **Configure Extension**

   a. Open Chat Memo Pro extension sidebar

   b. Navigate to **Cloud Sync** settings section

   c. Enter your credentials from steps 2 and 3:
      - **Project URL**: Paste from step 2a
      - **API Key**: Paste from step 2b (the `anon public` key)
      - **Email**: From step 3c (the user you created, NOT your Supabase account email)
      - **Password**: From step 3c (the password you set for the user)

   d. Click **"Test Connection"** to verify setup

   e. If successful, you'll see "Connection successful" ✅

#### 6. **Start Syncing**

   - Click **"Sync Now"** for immediate manual sync
   - Or enable **"Auto-sync"** and set interval (default: 15 minutes)
   - Check **Sync Status** to see progress and results

### Sync Status Indicators

- **Not Configured**: Cloud sync not set up yet
- **Connected (Idle)**: Ready to sync, no sync in progress
- **Syncing (Manual)**: User-initiated sync in progress
- **Syncing (Auto)**: Scheduled auto-sync in progress
- **Paused**: Sync paused due to errors (check status message)

### Migration & Data Safety

See [troubleshooting-manual.md](./troubleshooting-manual.md) for:
- Switching between Supabase accounts
- Resolving sync conflicts
- Debugging sync errors
- Performance optimization tips
- Data backup and recovery



## **📁 Locating Storage Files on Mac**

#### **Method 1: Using Chrome DevTools (Recommended)**

This is the easiest method to view and manage your data directly:

1. **Open the extension sidebar**
2. **Right-click on the sidebar** → Select "Inspect"
3. **In DevTools**:
   - Click the **Application** tab
   - Expand **IndexedDB** in the left panel
   - Find **KeepAIMemoryDB**
   - Click **conversations** to view all conversation data

#### **Method 2: Finding Files in the File System**

**Step 1: Find the Extension ID**

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Find "Chat Memo Pro" and copy the **ID** (e.g., `gefpcelbgaofbnehfglgibacfejejflp`)

**Step 2: Navigate to Storage Location**

1. Open **Finder**
2. Press `Cmd + Shift + G` (Go to Folder)
3. Enter the following path:

   `~/Library/Application Support/Google/Chrome/Default/IndexedDB/`

4. Find the folder: `chrome-extension_<your-extension-ID>_0.indexeddb.leveldb/`

**Example Path**:

`~/Library/Application Support/Google/Chrome/Default/IndexedDB/chrome-extension_gefpcelbgaofbnehfglgibacfejejflp_0.indexeddb.leveldb/`

#### **Method 3: Using Terminal Commands**

```bash
# 1. View all extension IndexedDB folders
ls -la ~/Library/Application\ Support/Google/Chrome/Default/IndexedDB/

# 2. Find folders containing "chrome-extension"
ls ~/Library/Application\ Support/Google/Chrome/Default/IndexedDB/ | grep chrome-extension

# 3. View files in a specific extension folder
ls -lh ~/Library/Application\ Support/Google/Chrome/Default/IndexedDB/chrome-extension_<extension-ID>_0.indexeddb.leveldb/
```

#### **⚠️ Important Notes**

1. **IndexedDB is Binary Format**:
   - Files are stored in LevelDB format and cannot be opened with text editors
   - Use Chrome DevTools to view content instead

2. **Backup Recommendations**:
   - Use the extension's **Export Wizard** feature to export data
   - Supports Markdown, JSON, and Plain Text formats
   - Safer and more readable

3. **To Backup the Raw Database**:

```bash
# Copy the entire database folder to a backup location
cp -r ~/Library/Application\ Support/Google/Chrome/Default/IndexedDB/chrome-extension_<extension-ID>_0.indexeddb.leveldb/ ~/Desktop/chat-memo-backup/
```


