==Phase 4-Phase 7 中的代码需要 Claude 一一 review==

# Tasks: Chat Memo Pro - Core Enhanced Features

**Input**: Design documents from `/specs/001-core-enhanced-features/`
**Prerequisites**: plan.md (technical implementation), spec.md (user stories with priorities)

**Tests**: Not explicitly requested - implementation tasks only

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Extension root**: `chat-memo-pro/`
- **Adapters**: `chat-memo-pro/js/adapters/`
- **Core modules**: `chat-memo-pro/js/core/`
- **UI**: `chat-memo-pro/html/popup.html`, `chat-memo-pro/js/popup.js`
- **Libraries**: `chat-memo-pro/lib/`
- **Manifest**: `chat-memo-pro/manifest.json`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verification of existing architecture

- [X] T001 Verify existing Chat Memo extension structure at `chat-memo-pro/`
- [X] T002 Verify existing 7 platform adapters in `chat-memo-pro/js/adapters/` (chatgpt, claude, gemini, deepseek, doubao, kimi, yuanbao)
- [X] T003 [P] Verify existing base adapter class in `chat-memo-pro/js/core/base.js`
- [X] T004 [P] Verify existing storage manager in `chat-memo-pro/js/core/storage-manager.js`
- [X] T005 [P] Review existing IndexedDB implementation in `chat-memo-pro/js/background.js` (line 287)
- [ ] T006 Create development branch `001-core-enhanced-features` from master
- [X] T007 Document existing adapter interface for reference (methods: isValidConversationUrl, extractConversationInfo, extractMessages, extractTitle, init, startObserving)

**Checkpoint**: Existing architecture documented, development branch ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Review and document BasePlatformAdapter class interface in `chat-memo-pro/js/core/base.js`
- [X] T009 Verify MutationObserver debounce delay constant (DEBOUNCE_DELAY = 300ms) exists in base adapter
- [X] T010 Verify content hash comparison logic for deduplication exists in base adapter
- [X] T011 Verify retry mechanism (maxRetries, retryCount) pattern from existing adapters
- [X] T012 Document platform name mappings in `chat-memo-pro/js/background.js` and `chat-memo-pro/js/popup.js`
- [X] T013 Verify chrome.storage.local save/retrieve methods in storage-manager.js

**Checkpoint**: Foundation verified - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Platform Adapters for Manus & Genspark (Priority: P1) 🎯 MVP

**Goal**: Add automatic conversation saving for Manus.im and Genspark.ai platforms

**Independent Test**: Visit Manus.im and Genspark.ai, have conversations, verify they appear in the extension's conversation list within 5 seconds with correct titles, messages, and metadata

### Implementation for User Story 1 - Manus Adapter

- [X] T014 [P] [US1] Create `chat-memo-pro/js/adapters/manus.js` with ManusAdapter class extending BasePlatformAdapter
- [X] T015 [US1] Implement isValidConversationUrl() method in manus.js to match URL pattern `https://manus.im/app/*`
- [X] T016 [US1] Implement extractConversationInfo() method in manus.js to extract task ID from URL using regex `/\/app\/([A-Za-z0-9]+)/`
- [X] T017 [US1] Implement heuristic looksLikeUserMessage() method in manus.js with user pattern keywords ('如何', '怎么', '写一个', '帮我', 'how', 'write', 'help me')
- [X] T018 [US1] Implement isUIElement() filter method in manus.js to exclude UI text ('New task', 'Search', 'Library', 'Share Manus', 'Settings')
- [X] T019 [US1] Implement findUserMessage() method in manus.js using heuristic text analysis (check for user patterns followed by AI response patterns)
- [X] T020 [US1] Implement extractAIResponse() method in manus.js to capture multi-part AI content (start patterns: '好的!', '收到!', 'I am currently'; stop patterns: 'Send message to Manus', 'How was this result?')
- [X] T021 [US1] Implement extractMessages() method in manus.js combining user and AI message extraction
- [X] T022 [US1] Implement extractTitle() method in manus.js with fallback: document.title → first user message (50 chars) → 'Manus Task'
- [X] T023 [US1] Implement initWithRetry() method in manus.js with retry mechanism (maxRetries: 10, interval: 1000ms)
- [X] T024 [US1] Implement startObserving() method in manus.js with MutationObserver on body element and 300ms debounce
- [X] T025 [US1] Implement handleMutation() method in manus.js with content hash deduplication using lastExtractedContent property
- [X] T026 [US1] Add window.addEventListener('load') initialization in manus.js

### Implementation for User Story 1 - Genspark Adapter

- [X] T027 [P] [US1] Create `chat-memo-pro/js/adapters/genspark.js` with GensparkAdapter class extending BasePlatformAdapter
- [X] T028 [US1] Implement isValidConversationUrl() method in genspark.js to match URL pattern `https://www.genspark.ai/agents?id=*`
- [X] T029 [US1] Implement extractConversationInfo() method in genspark.js to extract conversation ID from URL query parameter 'id'
- [X] T030 [US1] Implement extractMessages() method in genspark.js with fallback selector strategy: try '[class*="message"]' → '[class*="chat"]' → '[class*="conversation"]' → 'div[class*="flex"]' → 'div > div'
- [X] T031 [US1] Implement role detection logic in genspark.js extractMessages(): check for class names ('user', 'assistant', 'query', 'response') and CSS properties (textAlign, justifyContent)
- [X] T032 [US1] Implement isMessageElement() method in genspark.js to check for message-related class names
- [X] T033 [US1] Implement extractTitle() method in genspark.js with fallback: document.title → h1 element → '[class*="title"]' selector → 'Genspark Conversation'
- [X] T034 [US1] Add window.addEventListener('load') initialization in genspark.js

### Integration for User Story 1

- [X] T035 [US1] Update `chat-memo-pro/manifest.json` to add Manus content script entry with matches ["https://manus.im/*"] and js files: ["js/core/compatibility.js", "js/core/storage-manager.js", "js/core/base.js", "js/adapters/manus.js"]
- [X] T036 [US1] Update `chat-memo-pro/manifest.json` to add Genspark content script entry with matches ["https://www.genspark.ai/*"] and js files: ["js/core/compatibility.js", "js/core/storage-manager.js", "js/core/base.js", "js/adapters/genspark.js"]
- [X] T037 [US1] Update platform name mappings in `chat-memo-pro/js/background.js` to include 'manus' → 'Manus' and 'genspark' → 'Genspark'
- [X] T038 [US1] Update platform name mappings in `chat-memo-pro/js/popup.js` to include 'manus' and 'genspark' display names
- [X] T039 [US1] Update platform filter options in popup.js to include Manus and Genspark in dropdown/filter UI

**Checkpoint**: User Story 1 complete - Test by visiting Manus.im and Genspark.ai, having conversations, and verifying automatic save within 5 seconds

---

## Phase 4: User Story 2 - Fuzzy Search with Keyword Highlighting (Priority: P2)

**Goal**: Enable typo-tolerant search with highlighted results sorted by relevance

**Independent Test**: Create conversations with similar topics (e.g., "React Hooks Tutorial", "React Components"), search with typos (e.g., "recat hoks"), verify relevant results appear within 500ms with yellow highlighted keywords

### Library Integration for User Story 2

- [X] T040 [P] [US2] Download Fuse.js v7.0.0 or compatible version to `chat-memo-pro/lib/fuse.min.js`
- [X] T041 [US2] Add Fuse.js script tag to `chat-memo-pro/html/popup.html` before popup.js: `<script src="../lib/fuse.min.js"></script>`

### Implementation for User Story 2

- [X] T042 [US2] Create initializeFuzzySearch() function in `chat-memo-pro/js/popup.js` with Fuse configuration: keys: [{ name: 'title', weight: 2 }, { name: 'messages.content', weight: 1 }, { name: 'messages.thinking', weight: 0.5 }], threshold: 0.3, includeMatches: true, includeScore: true, minMatchCharLength: 2
- [X] T043 [US2] Create performFuzzySearch() function in popup.js to execute Fuse search and return results with matches and scores
- [X] T044 [US2] Create highlightMatches() function in popup.js to wrap matching text in `<mark class="highlight">` tags
- [X] T045 [US2] Implement sort by relevance logic in popup.js to sort results by Fuse score (lower = better match)
- [X] T046 [US2] Update applyFilters() function in popup.js to use AND logic combining: fuzzy keyword match + date range (Unix timestamps) + platform selection
- [X] T047 [US2] Implement date range filtering using Unix timestamps (milliseconds) for consistent cross-browser comparison
- [X] T048 [US2] Add search results rendering logic in popup.js to display highlighted keywords in conversation cards
- [X] T049 [US2] Add sort toggle UI in popup.html for "Sort by Relevance" vs "Sort by Date" options
- [X] T050 [US2] Add CSS styles to popup.html for `.highlight` class: background-color #fef08a, color #000, padding 0 2px, border-radius 2px, font-weight 500

**Checkpoint**: User Story 2 complete - Test by searching with typos ("recat"), verify results appear in <500ms with yellow highlighting and relevance sorting

---

## Phase 5: User Story 3 - Enhanced Export Wizard with Time Filters (Priority: P3)

**Goal**: Provide guided 3-step export wizard with time range selection, mode selection, and format options

**Independent Test**: Click "Export Data", select time range (Last Week), choose mode (Multiple Files), choose format (Markdown), verify ZIP file downloads with correct naming convention and YAML frontmatter

### UI Implementation for User Story 3

- [X] T051 [US3] Create export wizard container HTML structure in `chat-memo-pro/html/popup.html` with id="export-wizard"
- [X] T052 [US3] Create Step 1 UI in popup.html: Time Range selection with 6 preset buttons (All Time, Last Week, Last Month, Last 3 Months, Last Year, Custom Range) and custom datetime-local inputs
- [X] T053 [US3] Create Step 2 UI in popup.html: Export Mode selection with 2 buttons (Multiple Files ZIP, Single Document)
- [X] T054 [US3] Create Step 3 UI in popup.html: File Format selection with 3 buttons (Markdown, JSON, Plain Text)
- [X] T055 [US3] Create Export Preview Card in popup.html displaying: time range, mode, format, conversation count, output description, estimated file size
- [X] T056 [US3] Create "Start Export" button in popup.html with initial disabled state

### Logic Implementation for User Story 3

- [X] T057 [US3] Create exportWizard object in `chat-memo-pro/js/popup.js` with properties: timeRange, customDateRange, mode, format
- [X] T058 [US3] Implement selectTimeRange() method in popup.js exportWizard to handle preset selection and show/hide custom date inputs
- [X] T059 [US3] Implement calculateDateRange() method in popup.js exportWizard to compute Unix timestamp ranges for presets (day = 24*60*60*1000)
- [X] T060 [US3] Implement selectMode() method in popup.js exportWizard to store selected export mode
- [X] T061 [US3] Implement selectFormat() method in popup.js exportWizard to store selected file format
- [X] T062 [US3] Implement validateForm() method in popup.js exportWizard with AND logic: check timeRange AND mode AND format are all set
- [X] T063 [US3] Implement custom date range validation in validateForm(): ensure startTime < endTime, enable/disable "Start Export" button
- [X] T064 [US3] Implement updatePreview() method in popup.js exportWizard to update Export Preview Card with current selections
- [X] T065 [US3] Implement estimateSize() function in popup.js to calculate approximate file size based on conversation content length
- [X] T066 [US3] Implement filterConversations() method in popup.js exportWizard to apply time range filter using Unix timestamps

### Export Format Implementation for User Story 3

- [X] T067 [US3] Implement exportAsMarkdown() method in popup.js with YAML frontmatter generation (fields: title, platform, created, updated, messages, url)
- [X] T068 [US3] Implement thinking blocks rendering in exportAsMarkdown() using `<details>` and `<summary>` HTML tags
- [X] T069 [US3] Implement exportAsJSON() method in popup.js to serialize filtered conversations to JSON format
- [X] T070 [US3] Implement exportAsPlainText() method in popup.js with format: `[User]:` and `[Assistant]:` prefixes, 50-character dividers (=====...)
- [X] T071 [US3] Implement file naming sanitization function in popup.js: remove `<>:"/\|?*` characters, replace with underscores, preserve non-ASCII (Chinese, emoji)
- [X] T072 [US3] Implement file naming convention in popup.js: `[platform]_[YYYYMMDDHHMMSS]_[sanitized-title].[ext]`
- [X] T073 [US3] Implement multiple files ZIP export using JSZip library in popup.js: create ZIP archive named `conversations_[timestamp].zip`
- [X] T074 [US3] Implement single document export with merged conversations, table of contents (for Markdown format), and horizontal dividers
- [X] T075 [US3] Implement downloadFile() helper function in popup.js using Blob and URL.createObjectURL() for file download
- [X] T076 [US3] Add JSZip integration for multiple files mode: create archive, add files, generate blob, trigger download
- [X] T077 [US3] Add loading indicator UI during export process (show spinner for >500ms operations)
- [X] T078 [US3] Add file size warning for exports >100MB before proceeding

**Checkpoint**: User Story 3 complete - Test by exporting with different time ranges, modes, and formats, verify file naming and content structure

---

## Phase 6: User Story 4 - Resizable Sidebar with Responsive Breakpoints (Priority: P4)

**Goal**: Enable sidebar width resizing with drag handle, persist width, and apply responsive breakpoints

**Independent Test**: Drag right edge of sidebar from 320px to 800px, verify constraints, close/reopen extension to verify persistence, confirm responsive layout at 450px breakpoint

### Resize Handle Implementation for User Story 4

- [X] T079 [US4] Create ResizablePanel class in new file `chat-memo-pro/js/resizable-panel.js` with constructor accepting element and options (minWidth: 320, maxWidth: 800, defaultWidth: 400)
- [X] T080 [US4] Implement createResizeHandle() method in resizable-panel.js to create 5px-wide div with position absolute, right edge, col-resize cursor, transparent background
- [X] T081 [US4] Add hover effect to resize handle in resizable-panel.js: show blue overlay (rgba(59, 130, 246, 0.2)) on mouseenter, hide on mouseleave
- [X] T082 [US4] Implement startResize() method in resizable-panel.js to capture startX, startWidth, set document.body cursor and userSelect styles
- [X] T083 [US4] Implement resize() method in resizable-panel.js to calculate newWidth = startWidth + delta, enforce min/max constraints (320-800px)
- [X] T084 [US4] Implement stopResize() method in resizable-panel.js to clear cursor styles, save width to localStorage key 'sidebarWidth'
- [X] T085 [US4] Implement width tooltip display in resizable-panel.js: show centered overlay with current width in pixels during resize
- [X] T086 [US4] Add mousedown event listener to resize handle calling startResize()
- [X] T087 [US4] Add document-level mousemove event listener calling resize() when isResizing = true
- [X] T088 [US4] Add document-level mouseup event listener calling stopResize()

### Responsive Layout Implementation for User Story 4

- [X] T089 [US4] Implement updateResponsiveClasses() method in resizable-panel.js: add 'sidebar-narrow' class if width < 450px, add 'sidebar-wide' if width ≥ 450px
- [X] T090 [US4] Load saved width from localStorage on initialization in resizable-panel.js constructor, fallback to defaultWidth (400px)
- [X] T091 [US4] Call updateResponsiveClasses() during resize to apply classes dynamically
- [X] T092 [US4] Add CSS styles to popup.html for responsive breakpoints: `.sidebar-narrow .stats-container { grid-template-columns: 1fr; }` (vertical stacking)
- [X] T093 [US4] Add CSS styles to popup.html for wide sidebar: `.sidebar-wide .stats-container { grid-template-columns: 1fr 1fr; }` (horizontal layout)
- [X] T094 [US4] Add CSS styles to popup.html for preview text line clamp: `.sidebar-narrow .preview-text { -webkit-line-clamp: 1; }`
- [X] T095 [US4] Add CSS styles to popup.html for wide sidebar preview: `.sidebar-wide .preview-text { -webkit-line-clamp: 2; }`, very wide (>600px): 3 lines
- [X] T096 [US4] Add resize handle CSS styles to popup.html: position absolute, right 0, width 5px, height 100%, z-index 1000, transition for background color

### Integration for User Story 4

- [X] T097 [US4] Add `<script src="../js/resizable-panel.js"></script>` to popup.html before popup.js
- [X] T098 [US4] Initialize ResizablePanel in popup.js on DOMContentLoaded: `new ResizablePanel(document.querySelector('body'), { minWidth: 320, maxWidth: 800, defaultWidth: 400 })`
- [X] T099 [US4] Ensure sidebar element has position relative for absolute-positioned resize handle
- [X] T100 [US4] Add debouncing (300ms) to resize() method using requestAnimationFrame for smooth performance
- [X] T101 [US4] Test sidebar resize with rapid dragging to verify no visual glitches or excessive re-renders

**Checkpoint**: User Story 4 complete - Test by dragging sidebar edge, verifying constraints (320-800px), persistence after restart, and responsive layout changes at 450px breakpoint

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and documentation that affect multiple user stories

- [X] T102 [P] Add JSDoc comments to all new adapter files (manus.js, genspark.js)
- [X] T103 [P] Add JSDoc comments to exportWizard object methods in popup.js
- [X] T104 [P] Add JSDoc comments to ResizablePanel class methods in resizable-panel.js
- [X] T105 [P] Update `README.md` (if exists) to document new supported platforms (Manus, Genspark)
- [X] T106 [P] Update `README.md` to document fuzzy search feature with typo tolerance
- [X] T107 [P] Update `README.md` to document export wizard with time filters
- [X] T108 [P] Update `README.md` to document resizable sidebar feature
- [ ] T109 Perform manual testing checklist: Test Manus adapter on 10+ conversations
- [ ] T110 Perform manual testing checklist: Test Genspark adapter on 10+ conversations
- [ ] T111 Perform manual testing checklist: Test fuzzy search with intentional typos (10+ searches)
- [ ] T112 Perform manual testing checklist: Test export wizard with all time range presets
- [ ] T113 Perform manual testing checklist: Test export in all 3 formats (Markdown, JSON, Plain Text)
- [ ] T114 Perform manual testing checklist: Test sidebar resize at boundaries (320px, 800px, 450px breakpoint)
- [ ] T115 Test memory usage with 1000+ conversations using Chrome Task Manager (target: <150MB)
- [ ] T116 Test search performance with 1000+ conversations (target: <500ms response time)
- [ ] T117 Test export performance: 100 conversations single document (<10s), multiple files ZIP (<30s)
- [ ] T118 Verify no console errors or warnings in any user story scenarios
- [ ] T119 Run cross-platform compatibility test on Chrome 88+ and Edge Chromium
- [ ] T120 Verify all new features respect existing Vanilla JavaScript architecture (no React/TypeScript/framework dependencies)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001-T007) - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase (T008-T013) - Can start after Phase 2 complete
- **User Story 2 (Phase 4)**: Depends on Foundational phase (T008-T013) - Can start after Phase 2 complete, independent of US1
- **User Story 3 (Phase 5)**: Depends on Foundational phase (T008-T013) - Can start after Phase 2 complete, independent of US1/US2
- **User Story 4 (Phase 6)**: Depends on Foundational phase (T008-T013) - Can start after Phase 2 complete, completely independent of US1/US2/US3
- **Polish (Phase 7)**: Depends on completion of all desired user stories

### User Story Dependencies

- **User Story 1 (P1 - Platform Adapters)**: No dependencies on other stories - Can start immediately after Foundational phase
- **User Story 2 (P2 - Fuzzy Search)**: No dependencies on US1, but benefits from having more conversations (US1 platforms). Can be developed independently.
- **User Story 3 (P3 - Export Wizard)**: No dependencies on US1/US2. Works with existing conversations. Can be developed independently.
- **User Story 4 (P4 - Resizable Sidebar)**: Completely independent - UI-only feature. Can be developed in parallel with any other story.

### Within Each User Story

#### User Story 1 (Platform Adapters):
- Manus adapter (T014-T026) and Genspark adapter (T027-T034) can be developed in PARALLEL
- Integration tasks (T035-T039) must wait until both adapters are complete

#### User Story 2 (Fuzzy Search):
- Library integration (T040-T041) must complete before implementation tasks
- Implementation tasks (T042-T050) can proceed sequentially after library integration

#### User Story 3 (Export Wizard):
- UI implementation (T051-T056) can run in PARALLEL with logic implementation (T057-T066)
- Export format implementation (T067-T078) must wait until logic is complete

#### User Story 4 (Resizable Sidebar):
- Resize handle (T079-T088) and responsive layout (T089-T096) can run in PARALLEL
- Integration (T097-T101) must wait until both complete

### Parallel Opportunities

- **Phase 1 Setup**: All tasks (T001-T007) can run in parallel (documentation and verification)
- **Phase 2 Foundational**: All tasks (T008-T013) can run in parallel (reading existing code)
- **User Stories**: After Phase 2, all 4 user stories can be developed in parallel by different team members
- **Within US1**: Manus adapter (T014-T026) || Genspark adapter (T027-T034)
- **Within US3**: UI HTML (T051-T056) || Logic implementation (T057-T066)
- **Within US4**: Resize handle (T079-T088) || Responsive layout (T089-T096)
- **Polish Phase**: Documentation tasks (T102-T108) can all run in parallel

---

## Parallel Example: User Story 1 (Platform Adapters)

```bash
# Launch both adapter implementations together:
Task T014: "Create chat-memo-pro/js/adapters/manus.js with ManusAdapter class"
Task T027: "Create chat-memo-pro/js/adapters/genspark.js with GensparkAdapter class"

# Continue parallel development:
Task T015-T026: Implement all Manus adapter methods
Task T028-T034: Implement all Genspark adapter methods

# After both complete, run integration together:
Task T035: "Update manifest.json for Manus"
Task T036: "Update manifest.json for Genspark"
```

---

## Parallel Example: User Story 3 (Export Wizard)

```bash
# Launch UI and logic in parallel:
Task T051-T056: Create all HTML UI elements in popup.html
Task T057-T066: Implement exportWizard object logic in popup.js

# After both complete, implement export formats:
Task T067-T078: Implement all export format methods sequentially
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T013)
3. Complete Phase 3: User Story 1 (T014-T039)
4. **STOP and VALIDATE**: Test Manus and Genspark adapters independently
5. Deploy/demo if ready - **9 platforms supported!**

### Incremental Delivery

1. Complete Setup (T001-T007) + Foundational (T008-T013) → Foundation ready
2. Add User Story 1 (T014-T039) → Test independently → **Deploy MVP: 9 platforms supported**
3. Add User Story 2 (T040-T050) → Test independently → **Deploy: Fuzzy search enabled**
4. Add User Story 3 (T051-T078) → Test independently → **Deploy: Enhanced export wizard**
5. Add User Story 4 (T079-T101) → Test independently → **Deploy: Resizable sidebar**
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup (T001-T007) + Foundational (T008-T013) together
2. Once Foundational is done:
   - **Developer A**: User Story 1 - Platform Adapters (T014-T039)
   - **Developer B**: User Story 2 - Fuzzy Search (T040-T050)
   - **Developer C**: User Story 3 - Export Wizard (T051-T078)
   - **Developer D**: User Story 4 - Resizable Sidebar (T079-T101)
3. Stories complete and integrate independently
4. Run Polish phase (T102-T120) together

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **[Story] label** = maps task to specific user story (US1, US2, US3, US4) for traceability
- **Each user story** is independently completable and testable
- **Existing architecture** must be preserved (Vanilla JavaScript, no frameworks)
- **File paths** are exact and absolute for immediate execution
- **Commit** after each task or logical group for incremental progress
- **Stop at any checkpoint** to validate story independently
- **Avoid**: vague tasks, same file conflicts, cross-story dependencies that break independence
- **Constitution compliance**: All tasks respect Progressive Enhancement, Chrome Extension Best Practices, Platform Adapter Robustness, User Experience, and Data Integrity principles

---

## Task Summary

- **Total tasks**: 120
- **Setup tasks**: 7 (T001-T007)
- **Foundational tasks**: 6 (T008-T013)
- **User Story 1 (Platform Adapters)**: 26 tasks (T014-T039)
- **User Story 2 (Fuzzy Search)**: 11 tasks (T040-T050)
- **User Story 3 (Export Wizard)**: 28 tasks (T051-T078)
- **User Story 4 (Resizable Sidebar)**: 23 tasks (T079-T101)
- **Polish tasks**: 19 (T102-T120)

**Parallel opportunities identified**:
- Setup: 7 tasks can run in parallel
- Foundational: 6 tasks can run in parallel
- User stories: All 4 can develop in parallel after Foundational
- Within US1: Manus and Genspark adapters (2 parallel streams)
- Within US3: UI and logic (2 parallel streams)
- Within US4: Resize handle and responsive layout (2 parallel streams)
- Polish: 7 documentation tasks can run in parallel

**Independent test criteria**:
- **US1**: Visit platforms, have conversations, verify automatic save within 5 seconds
- **US2**: Search with typos, verify results <500ms with yellow highlighting
- **US3**: Export with wizard, verify file naming, frontmatter, and content structure
- **US4**: Drag sidebar edge, verify constraints and persistence

**Suggested MVP scope**: User Story 1 only (Platform Adapters) - delivers immediate value with 9 total platforms supported
