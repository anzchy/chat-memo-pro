# Feature Specification: Chat Memo Pro - Core Enhanced Features

**Feature Branch**: `001-core-enhanced-features`
**Created**: 2025-12-08
**Status**: Draft
**Input**: User description: "这是一个基于已有 Chrome extension 做增强的项目,我列出了 plan.md,现在根据chat_memo_research_report_v2.md 和 plan.md,二者结合补充写 spec.md。记住原来的框架不能修改。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Platform Adapters for Manus & Genspark (Priority: P1)

As a heavy AI platform user, I want the extension to automatically save conversations from Manus.im and Genspark.ai platforms, so that I can have a complete record of all my AI interactions across all major platforms.

**Why this priority**: These are the only two remaining major AI platforms not yet supported. Without them, users lose valuable conversation data from these platforms, creating gaps in their AI memory repository. This is the foundation for all other enhancements.

**Independent Test**: Can be fully tested by visiting Manus.im or Genspark.ai, having a conversation with the AI, and verifying that the conversation appears in the Chat Memo Pro extension's conversation list with correct title, content, and metadata.

**Acceptance Scenarios**:

1. **Given** user is on Manus.im with the extension installed, **When** user completes a task conversation with the AI, **Then** the conversation is automatically saved to local storage within 5 seconds with the correct user messages and AI responses
2. **Given** user is on Genspark.ai with the extension installed, **When** user has a conversation with the Super Agent, **Then** all messages including thinking blocks are captured and saved automatically
3. **Given** user edits or regenerates a message on either platform, **When** the AI provides a new response, **Then** the latest version of the conversation is saved (not duplicated)
4. **Given** user navigates away from the conversation page, **When** they return later, **Then** the conversation continues to be monitored and new messages are captured
5. **Given** the platform updates its UI structure, **When** messages appear in new DOM locations, **Then** the adapter's fallback selectors continue to capture messages correctly

---

### User Story 2 - Fuzzy Search with Keyword Highlighting (Priority: P2)

As a user with hundreds of saved conversations, I want to find specific conversations quickly using fuzzy search (tolerating typos), so that I can retrieve relevant AI insights without remembering exact wording.

**Why this priority**: With the foundation (P1) in place, users will accumulate more conversations. Basic string search becomes inadequate. Fuzzy search enables discovery of conversations even when users misremember keywords or have typos.

**Independent Test**: Can be fully tested by creating multiple conversations with similar topics (e.g., "React Hooks Tutorial", "React Components Guide"), then searching with typos (e.g., "recat hoks") and verifying that relevant results appear with keywords highlighted.

**Acceptance Scenarios**:

1. **Given** user has 100+ conversations saved, **When** user searches for "recat" (typo for "React"), **Then** all conversations containing "React" appear in search results within 500ms
2. **Given** search results are displayed, **When** keywords match in title or message content, **Then** matching text is highlighted in yellow for easy identification
3. **Given** user searches for "authentication", **When** results include conversations mentioning "auth", "login", or "authentication", **Then** results are sorted by relevance score (best matches first)
4. **Given** user searches with multiple keywords, **When** query is "React hooks tutorial", **Then** conversations containing any of these words are returned, ranked by how many keywords they match
5. **Given** user has conversations across multiple platforms, **When** searching, **Then** results can be filtered by platform, date range, and other criteria using AND logic

---

### User Story 3 - Enhanced Export Wizard with Time Filters (Priority: P3)

As a user wanting to back up or analyze specific conversations, I want a guided 3-step export wizard with time range selection and format options, so that I can easily export exactly the conversations I need in my preferred format.

**Why this priority**: While export functionality exists, it lacks user guidance and flexibility. This enhancement makes data portability more accessible and useful for downstream analysis (Obsidian, Notion, etc.).

**Independent Test**: Can be fully tested by selecting different time ranges (last week, custom dates), choosing export modes (single file vs. ZIP), selecting formats (Markdown, JSON, Plain Text), and verifying that exported files match the preview specifications.

**Acceptance Scenarios**:

1. **Given** user clicks "Export Data", **When** the export wizard opens, **Then** a 3-step interface appears: (1) Choose Time Range, (2) Choose Mode, (3) Choose Format
2. **Given** user is on Step 1, **When** user selects "Last Week" preset, **Then** the wizard automatically calculates the date range and shows conversation count preview
3. **Given** user selects custom date range, **When** start date is after end date, **Then** an error message appears and the "Next" button is disabled until dates are valid
4. **Given** all steps are complete, **When** user reviews the Export Preview card, **Then** it shows: time range, mode, format, conversation count, output description, and estimated file size
5. **Given** user clicks "Start Export" with mode="Multiple Files" and format="Markdown", **When** export completes, **Then** a ZIP file downloads containing individual Markdown files with YAML frontmatter, following naming convention: `[platform]_[YYYYMMDDHHMMSS]_[sanitized-title].md`
6. **Given** user exports with mode="Single Document" and format="Plain Text", **When** export completes, **Then** a single `.txt` file downloads with all conversations separated by horizontal dividers

---

### User Story 4 - Resizable Sidebar with Responsive Breakpoints (Priority: P4)

As a user working on different screen sizes and tasks, I want to resize the extension's sidebar width by dragging, so that I can optimize screen space usage based on my current needs.

**Why this priority**: This is a quality-of-life enhancement that improves UX but doesn't block core functionality. Users can adapt the interface to their workflow preferences.

**Independent Test**: Can be fully tested by dragging the right edge of the sidebar, verifying width constraints (320-800px), checking that width persists after browser restart, and confirming that content layout adapts responsively at the 450px breakpoint.

**Acceptance Scenarios**:

1. **Given** user hovers over the right edge of the sidebar (5px area), **When** the cursor enters this zone, **Then** the cursor changes to `col-resize` (↔) and the edge highlights slightly
2. **Given** user drags the resize handle, **When** dragging beyond 800px, **Then** width stops at 800px maximum
3. **Given** user drags the resize handle, **When** dragging below 320px, **Then** width stops at 320px minimum
4. **Given** user resizes the sidebar to 400px, **When** user closes and reopens the extension, **Then** the sidebar opens at 400px (persisted via localStorage)
5. **Given** sidebar width is 400px (narrow), **When** viewing the stats section, **Then** stat cards stack vertically (1 column) and conversation previews show 1 line
6. **Given** sidebar width is 600px (wide), **When** viewing the stats section, **Then** stat cards display horizontally (2 columns) and conversation previews show 3 lines

---

### Edge Cases

- **What happens when a platform completely changes its DOM structure?** The adapter should log errors to the console with prefix "Keep AI Memory ([Platform]): " and notify the user via the floating indicator that capture has failed. The adapter's retry mechanism (max 10 retries) should attempt to re-initialize.

- **How does the system handle duplicate messages?** Before saving, the adapter computes a content hash of messages and compares against the last saved hash. Only if the hash differs does it save, preventing duplicates.

- **What if the user has 10,000+ conversations and searches?** The fuzzy search uses Fuse.js with a threshold of 0.3 and limits initial results to 100. Pagination or infinite scroll can be implemented if performance degrades.

- **What happens when exporting 500+ conversations as multiple files?** The system shows a loading indicator, estimates file size beforehand in the preview card, and uses JSZip to efficiently create the archive. If the ZIP exceeds 100MB, the system warns the user before proceeding.

- **How does the system handle browser memory limits?** IndexedDB is used for conversation storage (theoretically unlimited), while localStorage stores only UI state (sidebar width). The extension targets <150MB total memory usage, monitored via Chrome Task Manager.

- **What if the user resizes the sidebar while an animation is running?** The resize handler uses `requestAnimationFrame` to ensure smooth updates, and debouncing (300ms) prevents excessive re-renders during rapid dragging.

- **What happens when a conversation has special characters in the title during export?** The file naming function sanitizes titles by removing `<>:"/\|?*` characters and replacing them with underscores. Non-ASCII characters (Chinese, emoji) are preserved using encodeURIComponent where necessary.

## Requirements *(mandatory)*

### Functional Requirements

#### Platform Adapter Requirements

- **FR-001**: System MUST detect when the user is on Manus.im (URL pattern: `https://manus.im/app/*`) and initialize the Manus adapter within 5 seconds
- **FR-002**: System MUST detect when the user is on Genspark.ai (URL pattern: `https://www.genspark.ai/agents?id=*`) and initialize the Genspark adapter within 5 seconds
- **FR-003**: Manus adapter MUST extract user messages using heuristic text analysis (pattern matching for user request keywords) when semantic selectors are unavailable
- **FR-004**: Manus adapter MUST extract AI responses including multi-part content (thinking process, action steps, results, code files) by detecting AI response start patterns
- **FR-005**: Genspark adapter MUST extract messages using fallback selector strategy (try `[class*="message"]`, `[class*="chat"]`, structural selectors in priority order)
- **FR-006**: Both adapters MUST deduplicate messages by comparing content hashes before saving to prevent duplicate records
- **FR-007**: Both adapters MUST implement retry mechanism (max 10 retries, 1-second intervals) if DOM container not found on initial load
- **FR-008**: Both adapters MUST use MutationObserver with 300ms debouncing to monitor DOM changes efficiently
- **FR-009**: Both adapters MUST extract conversation titles from page `<title>` element or fallback to first user message (max 50 characters + "...")
- **FR-010**: System MUST update manifest.json to include content script matches for both new platforms

#### Fuzzy Search Requirements

- **FR-011**: System MUST integrate Fuse.js library (v7.0.0 or compatible) for fuzzy searching across conversation titles, message content, and thinking blocks
- **FR-012**: Search engine MUST configure Fuse.js with keys: `title` (weight: 2), `messages.content` (weight: 1), `messages.thinking` (weight: 0.5)
- **FR-013**: Search engine MUST set Fuse.js threshold to 0.3 for reasonable typo tolerance (lower = stricter matching)
- **FR-014**: Search results MUST highlight matching keywords using `<mark class="highlight">` tags with yellow background (`#fef08a`)
- **FR-015**: Search results MUST be sortable by "relevance" (Fuse.js score) or "date" (updatedAt timestamp descending)
- **FR-016**: Search MUST respond within 500ms for up to 1000 conversations (target performance metric)
- **FR-017**: Filter logic MUST combine search keyword, date range, and platform selection using AND logic (all conditions must be true)
- **FR-018**: Date range filters MUST use Unix timestamps (milliseconds) for consistent comparison across browsers

#### Export Wizard Requirements

- **FR-019**: Export wizard UI MUST display as a 3-step guided interface: (1) Time Range, (2) Export Mode, (3) File Format
- **FR-020**: Step 1 MUST provide time range presets: "All Time", "Last Week" (7 days), "Last Month" (30 days), "Last 3 Months" (90 days), "Last Year" (365 days), "Custom Range"
- **FR-021**: Custom date range MUST validate that start datetime is before end datetime, showing error if invalid
- **FR-022**: Step 2 MUST provide export mode options: "Multiple Files (ZIP)" or "Single Document"
- **FR-023**: Step 3 MUST provide format options: "Markdown (.md)", "JSON (.json)", "Plain Text (.txt)"
- **FR-024**: Export Preview Card MUST display: selected time range, selected mode, selected format, filtered conversation count, output file description, estimated file size
- **FR-025**: "Start Export" button MUST be disabled until all 3 steps are completed (AND logic validation)
- **FR-026**: Markdown exports MUST include YAML frontmatter with fields: title, platform, created, updated, messages, url
- **FR-027**: Markdown exports MUST preserve message thinking blocks as collapsible `<details>` sections
- **FR-028**: File naming MUST follow convention: `[platform]_[YYYYMMDDHHMMSS]_[sanitized-title].[ext]`
- **FR-029**: File naming MUST sanitize titles by replacing special characters `<>:"/\|?*` with underscores
- **FR-030**: Multiple Files export MUST use JSZip to create a `.zip` archive named `conversations_[timestamp].zip`
- **FR-031**: Single Document export MUST merge conversations with horizontal dividers and table of contents (for Markdown format)
- **FR-032**: Plain Text export MUST format messages with `[User]:` and `[Assistant]:` prefixes, separated by 50-character dividers

#### Resizable Sidebar Requirements

- **FR-033**: Sidebar MUST have a 5px-wide resize handle along the right edge with `col-resize` cursor
- **FR-034**: Resize handle MUST highlight with 20% blue overlay (`rgba(59, 130, 246, 0.2)`) on hover
- **FR-035**: Sidebar width MUST be constrained between 320px (minimum) and 800px (maximum)
- **FR-036**: Default sidebar width MUST be 400px on first install
- **FR-037**: Sidebar width MUST persist to localStorage (key: `sidebarWidth`) after each resize operation
- **FR-038**: Sidebar width MUST restore from localStorage on extension reopening
- **FR-039**: During resize, a tooltip MUST display current width in pixels centered on screen
- **FR-040**: Sidebar MUST apply CSS class `sidebar-narrow` when width < 450px
- **FR-041**: Sidebar MUST apply CSS class `sidebar-wide` when width ≥ 450px
- **FR-042**: Stats cards MUST stack vertically (grid-template-columns: 1fr) when `sidebar-narrow` class is applied
- **FR-043**: Stats cards MUST display horizontally (grid-template-columns: 1fr 1fr) when `sidebar-wide` class is applied
- **FR-044**: Conversation preview text MUST limit to 1 line (`-webkit-line-clamp: 1`) when width < 450px
- **FR-045**: Conversation preview text MUST limit to 2 lines when width 450-600px, and 3 lines when width > 600px

### Key Entities

- **PlatformAdapter**: Represents a strategy for extracting conversation data from a specific AI platform. Key attributes: platform name, URL pattern, DOM selectors (container, user message, AI message, thinking blocks), extraction methods, retry logic, deduplication hash cache.

- **Conversation**: Represents a saved AI conversation. Key attributes: unique ID, platform source, title, array of messages, created timestamp, updated timestamp, original URL, tags (optional), starred flag (optional).

- **Message**: Represents a single message within a conversation. Key attributes: unique ID, role (user/assistant), text content, thinking process content (optional), artifacts (code/images), timestamp, edited flag, version number.

- **SearchIndex**: Represents the Fuse.js search engine instance configured with conversation data. Key attributes: Fuse instance, search keys with weights, threshold, match highlighting function.

- **ExportConfiguration**: Represents user's export preferences. Key attributes: time range (preset or custom), date range boundaries (start/end timestamps), export mode (multiple/single), file format (md/json/txt), filtered conversation list, estimated file size.

- **ResizablePanel**: Represents the sidebar UI component with resizing capability. Key attributes: current width, min/max constraints, resize handle element, isResizing state, stored width in localStorage, responsive breakpoint classes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can have conversations on Manus.im or Genspark.ai and see them automatically appear in the extension's conversation list within 5 seconds (95% success rate across 10 test conversations per platform)

- **SC-002**: Users searching for conversations with intentional typos (e.g., "recat" for "React") receive relevant results within 500ms, with at least 90% of expected conversations found in the top 10 results

- **SC-003**: Users can export 100 conversations in under 10 seconds for single document export, and under 30 seconds for multiple files (ZIP) export, on a standard laptop (8GB RAM, SSD)

- **SC-004**: Users can resize the sidebar smoothly without lag or visual glitches, with width persisting correctly across 100% of browser restarts

- **SC-005**: The extension maintains memory usage below 150MB even with 1000+ conversations saved, as measured by Chrome Task Manager

- **SC-006**: 90% of users can complete their first export using the wizard without external help or documentation (validated through usability testing with 10 users)

- **SC-007**: Keyword highlighting in search results improves user satisfaction by reducing time-to-find target conversation by at least 30% compared to unhighlighted results (measured through A/B testing)

- **SC-008**: The export wizard's AND logic validation (all steps required) reduces incomplete exports by 80% compared to unconstrained export flow (measured by export completion rate)

- **SC-009**: Responsive layout breakpoints (at 450px width) adapt correctly for 100% of sidebar widths tested (320px, 400px, 450px, 600px, 800px), with no content overflow or misalignment

- **SC-010**: Platform adapters continue to function correctly after simulated DOM structure changes, with fallback selectors successfully capturing at least 80% of messages when primary selectors fail (tested with modified platform HTML)

### Assumptions

1. **Platform Stability**: We assume Manus.im and Genspark.ai will not undergo major architectural rewrites that completely break DOM structure within the first 6 months post-launch. Mitigation: Multiple fallback selectors and heuristic text analysis provide resilience.

2. **Browser Compatibility**: We assume Chrome 88+ and Edge Chromium support all required APIs (MutationObserver, IndexedDB, localStorage, Fuse.js). Mitigation: These are widely supported stable APIs.

3. **User Behavior**: We assume users primarily interact with 5-9 AI platforms (not 20+), with average conversation length of 5-20 messages. This informs performance targets.

4. **Export Use Cases**: We assume users export data primarily for backup (all conversations) or analysis (recent subset), not for real-time streaming or API integration. Mitigation: Batch export is sufficient.

5. **Screen Sizes**: We assume users work on laptop screens (13-27 inches, 1280x800 to 2560x1440 resolution) where sidebar resizing provides value. Mobile use is not prioritized.

6. **Data Retention**: We assume users want indefinite local storage of conversations unless manually deleted. No automatic cleanup or expiration is implemented in V1.

7. **Language Support**: We assume UI strings and search work primarily in English and Chinese (based on target user base). Full i18n is deferred to V2.

8. **Network Conditions**: We assume users have stable internet when using AI platforms, but the extension operates fully offline once conversations are saved (local-first architecture).

9. **Platform Permissions**: We assume users will grant necessary host permissions for the 2 new platforms during installation or first use. Chrome's permission model handles prompting.

10. **Framework Stability**: We assume Vanilla JavaScript architecture remains viable and performant for the planned feature set. No framework migration is needed for these enhancements.
