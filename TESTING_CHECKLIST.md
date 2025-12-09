# Chat Memo Pro - Manual Testing Checklist

This checklist covers all manual testing requirements for Phase 4-7 features (T109-T120).

## Setup Instructions

1. Load the extension in Chrome via `chrome://extensions/` (Developer Mode → Load unpacked)
2. Ensure you have test data:
   - At least 10+ conversations on Manus.im
   - At least 10+ conversations on Genspark.ai
   - Ideally 100+ conversations across all platforms for performance testing
   - Ideally 1000+ conversations for stress testing

---

## Phase 3: Platform Adapters Testing

### T109: Test Manus Adapter (manus.im)
**Target**: Verify adapter works correctly on 10+ conversations

- [ ] Navigate to https://manus.im
- [ ] Open Developer Console and run: `cmDebug.status()`
- [ ] Verify platform detected as "Manus"
- [ ] Create or open 10+ different conversations
- [ ] For each conversation:
  - [ ] Check that conversation ID is correctly extracted
  - [ ] Run `cmDebug.getMessages()` - verify messages are captured
  - [ ] Run `cmDebug.getTitle()` - verify title is generated
  - [ ] Verify auto-save triggers (if enabled)
  - [ ] Check extension popup shows the conversation
- [ ] Test edge cases:
  - [ ] Very long conversation (100+ messages)
  - [ ] Conversation with code blocks
  - [ ] Conversation with special characters in title
- [ ] **PASS CRITERIA**: All conversations saved correctly, no console errors

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Passed | ❌ Failed
**Notes**: _____________________________________________

---

### T110: Test Genspark Adapter (genspark.ai)
**Target**: Verify adapter works correctly on 10+ conversations

- [ ] Navigate to https://genspark.ai
- [ ] Open Developer Console and run: `cmDebug.status()`
- [ ] Verify platform detected as "Genspark"
- [ ] Create or open 10+ different conversations
- [ ] For each conversation:
  - [ ] Check that conversation ID is correctly extracted
  - [ ] Run `cmDebug.getMessages()` - verify messages are captured
  - [ ] Run `cmDebug.getTitle()` - verify title is generated
  - [ ] Verify auto-save triggers (if enabled)
  - [ ] Check extension popup shows the conversation
- [ ] Test edge cases:
  - [ ] Very long conversation (100+ messages)
  - [ ] Conversation with multimedia content
  - [ ] Conversation with special characters in title
- [ ] **PASS CRITERIA**: All conversations saved correctly, no console errors

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Passed | ❌ Failed
**Notes**: _____________________________________________

---

## Phase 4: Fuzzy Search Testing

### T111: Test Fuzzy Search with Intentional Typos (10+ searches)
**Target**: Verify typo tolerance works correctly

Test each of the following search scenarios:

1. **Typo in Title**:
   - [ ] Search: "chatgpt tutorial" (actual: "ChatGPT Tutorial")
   - [ ] Search: "marchine learning" (actual: "Machine Learning")
   - [ ] Verify: Results show despite typos, highlighted in yellow

2. **Typo in Platform Name**:
   - [ ] Search: "claud" (actual: "Claude")
   - [ ] Search: "perplexty" (actual: "Perplexity")
   - [ ] Verify: Conversations from correct platform appear

3. **Missing Characters**:
   - [ ] Search: "pythn" (actual: "Python")
   - [ ] Search: "javasript" (actual: "JavaScript")
   - [ ] Verify: Relevant conversations found

4. **Extra Characters**:
   - [ ] Search: "debugging code" (actual: "debug code")
   - [ ] Verify: Matches found

5. **Transposed Letters**:
   - [ ] Search: "recieve" (actual: "receive")
   - [ ] Verify: Results appear

6. **Case Insensitivity**:
   - [ ] Search: "API DESIGN" (actual: "api design")
   - [ ] Search: "ReST" (actual: "REST")
   - [ ] Verify: Results found regardless of case

7. **Partial Matches**:
   - [ ] Search: "neural" (matches: "neural network", "neural architecture")
   - [ ] Verify: All relevant conversations appear

8. **Multi-word Fuzzy**:
   - [ ] Search: "maching larnin algoritm" (actual: "machine learning algorithm")
   - [ ] Verify: Relevant conversations found

9. **Special Characters Handling**:
   - [ ] Search: "c++ tutorial"
   - [ ] Search: "how-to guide"
   - [ ] Verify: Special characters don't break search

10. **Empty/Invalid Searches**:
    - [ ] Search: "" (empty string)
    - [ ] Search: "   " (only spaces)
    - [ ] Verify: No errors, shows all conversations or helpful message

**Verification**:
- [ ] All search terms highlighted in yellow (`mark.highlight` class)
- [ ] Search results update in real-time as you type
- [ ] No console errors during any search
- [ ] **PASS CRITERIA**: 9/10 fuzzy searches return relevant results

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Passed | ❌ Failed
**Notes**: _____________________________________________

---

## Phase 5: Export Wizard Testing

### T112: Test Export Wizard - All Time Range Presets
**Target**: Verify all 6 time range options work correctly

For each time range, verify the preview count and successful export:

1. **All Time**:
   - [ ] Click Export button → Select "All Time"
   - [ ] Verify preview shows total conversation count
   - [ ] Export and verify all conversations included

2. **Last Week**:
   - [ ] Select "Last Week"
   - [ ] Verify preview count matches conversations from last 7 days
   - [ ] Export and verify date filtering correct

3. **Last Month**:
   - [ ] Select "Last Month"
   - [ ] Verify preview count matches conversations from last 30 days
   - [ ] Export and verify date filtering correct

4. **Last 3 Months**:
   - [ ] Select "Last 3 Months"
   - [ ] Verify preview count matches conversations from last 90 days
   - [ ] Export and verify date filtering correct

5. **Last Year**:
   - [ ] Select "Last Year"
   - [ ] Verify preview count matches conversations from last 365 days
   - [ ] Export and verify date filtering correct

6. **Custom Range**:
   - [ ] Select "Custom Range"
   - [ ] Verify date pickers appear
   - [ ] Set start date: 2024-01-01, end date: 2024-12-31
   - [ ] Verify preview updates with custom range count
   - [ ] Test invalid range (start > end) - verify button disabled
   - [ ] Test valid range and export

**Verification**:
- [ ] Preview count updates correctly for each range
- [ ] Preview size (MB/KB) displays and seems reasonable
- [ ] Format display shows correctly (e.g., "Markdown (.md) (ZIP Archive)")
- [ ] **PASS CRITERIA**: All 6 time ranges filter correctly

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Passed | ❌ Failed
**Notes**: _____________________________________________

---

### T113: Test Export in All 3 Formats
**Target**: Verify Markdown, JSON, and Plain Text exports work correctly

For each format, test both Single and Multiple modes:

#### **Markdown Format**:

1. **Single Merged File**:
   - [ ] Export Wizard → Mode: Single → Format: Markdown
   - [ ] Export 5-10 conversations
   - [ ] Verify downloaded file has `.md` extension
   - [ ] Open file and verify:
     - [ ] YAML frontmatter present for each conversation
     - [ ] Proper markdown headers (`#`, `##`)
     - [ ] Conversations separated by `---`
     - [ ] All messages included with roles (User/Assistant)

2. **Multiple Files (ZIP)**:
   - [ ] Export Wizard → Mode: Multiple → Format: Markdown
   - [ ] Export 5-10 conversations
   - [ ] Verify downloaded file has `.zip` extension
   - [ ] Extract ZIP and verify:
     - [ ] One `.md` file per conversation
     - [ ] Filenames include platform, date, and sanitized title
     - [ ] Each file has YAML frontmatter
     - [ ] All content preserved

#### **JSON Format**:

3. **Single Merged File**:
   - [ ] Export Wizard → Mode: Single → Format: JSON
   - [ ] Export 5-10 conversations
   - [ ] Verify downloaded file has `.json` extension
   - [ ] Open in text editor or JSON viewer and verify:
     - [ ] Valid JSON structure (no syntax errors)
     - [ ] Contains `meta` object with `exportedAt`, `count`, `version`
     - [ ] Contains `data` array with all conversations
     - [ ] All fields preserved (conversationId, title, platform, messages, etc.)

4. **Multiple Files (ZIP)**:
   - [ ] Export Wizard → Mode: Multiple → Format: JSON
   - [ ] Export 5-10 conversations
   - [ ] Extract ZIP and verify:
     - [ ] One `.json` file per conversation
     - [ ] Each JSON is valid and parseable
     - [ ] All conversation data intact

#### **Plain Text Format**:

5. **Single Merged File**:
   - [ ] Export Wizard → Mode: Single → Format: Plain Text
   - [ ] Export 5-10 conversations
   - [ ] Verify downloaded file has `.txt` extension
   - [ ] Open file and verify:
     - [ ] Headers with title, platform, date, URL
     - [ ] Separator lines (`=`.repeat(50))
     - [ ] All messages with role labels
     - [ ] Conversations separated clearly

6. **Multiple Files (ZIP)**:
   - [ ] Export Wizard → Mode: Multiple → Format: Plain Text
   - [ ] Export 5-10 conversations
   - [ ] Extract ZIP and verify:
     - [ ] One `.txt` file per conversation
     - [ ] Readable plain text format
     - [ ] All content preserved

**Verification**:
- [ ] All exports complete without errors
- [ ] Loading spinner appears during export
- [ ] Success message shows after completion
- [ ] Wizard closes automatically after success
- [ ] **PASS CRITERIA**: All 6 format/mode combinations work correctly

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Passed | ❌ Failed
**Notes**: _____________________________________________

---

## Phase 6: Resizable Sidebar Testing

### T114: Test Sidebar Resize at Boundaries
**Target**: Verify drag-to-resize works correctly at min/max/breakpoint widths

#### **Basic Resize Functionality**:
1. **Visual Handle**:
   - [ ] Open extension popup
   - [ ] Locate resize handle on left edge (5px width)
   - [ ] Hover over handle - verify blue highlight appears
   - [ ] Verify cursor changes to `col-resize`

2. **Resize Interaction**:
   - [ ] Click and drag handle to the left
   - [ ] Verify sidebar width increases smoothly
   - [ ] Verify tooltip shows current width (e.g., "450px")
   - [ ] Release mouse - verify width is saved
   - [ ] Click and drag handle to the right
   - [ ] Verify sidebar width decreases smoothly
   - [ ] Verify tooltip updates

3. **Persistence**:
   - [ ] Resize sidebar to 600px
   - [ ] Close popup
   - [ ] Reopen popup
   - [ ] Verify width is still 600px (localStorage persistence)

#### **Boundary Testing**:

4. **Minimum Width (320px)**:
   - [ ] Drag handle as far right as possible
   - [ ] Verify width stops at 320px (can't go smaller)
   - [ ] Verify tooltip shows "320px"
   - [ ] Verify no visual glitches or content overflow

5. **Maximum Width (800px)**:
   - [ ] Drag handle as far left as possible
   - [ ] Verify width stops at 800px (can't go larger)
   - [ ] Verify tooltip shows "800px"
   - [ ] Verify no layout issues

6. **Breakpoint: 450px (Narrow ↔ Wide)**:
   - [ ] Set width to 440px (just below breakpoint)
   - [ ] Verify `.sidebar-narrow` class applied
   - [ ] Verify stats container uses 1-column grid
   - [ ] Verify preview text shows 1 line (`-webkit-line-clamp: 1`)
   - [ ] Resize to 460px (just above breakpoint)
   - [ ] Verify `.sidebar-wide` class applied
   - [ ] Verify stats container uses 2-column grid
   - [ ] Verify preview text shows 2 lines (`-webkit-line-clamp: 2`)

7. **Breakpoint: 600px (Wide ↔ Very Wide)**:
   - [ ] Set width to 590px
   - [ ] Verify preview text shows 2 lines
   - [ ] Resize to 610px
   - [ ] Verify preview text shows 3 lines (`-webkit-line-clamp: 3`)

#### **Edge Cases**:

8. **Rapid Dragging**:
   - [ ] Quickly drag handle back and forth
   - [ ] Verify no performance issues or lag
   - [ ] Verify requestAnimationFrame provides smooth rendering

9. **Mouse Release Outside Window**:
   - [ ] Start dragging handle
   - [ ] Move mouse outside browser window and release
   - [ ] Verify resize stops cleanly (no stuck drag state)

10. **Text Selection During Drag**:
    - [ ] Start dragging
    - [ ] Verify text selection is disabled (`user-select: none`)
    - [ ] Release - verify text selection works again

**Verification**:
- [ ] No console errors during any resize operation
- [ ] Handle visual feedback works (hover, active states)
- [ ] Responsive classes apply correctly at breakpoints
- [ ] Width persists across sessions
- [ ] **PASS CRITERIA**: All boundary conditions and breakpoints work correctly

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Passed | ❌ Failed
**Notes**: _____________________________________________

---

## Phase 7: Performance & Polish Testing

### T115: Test Memory Usage with 1000+ Conversations
**Target**: Extension uses <150MB RAM with 1000+ conversations loaded

**Prerequisites**: Populate database with 1000+ conversations (use auto-save or manual saves)

**Procedure**:
1. [ ] Close all other tabs and extensions
2. [ ] Open Chrome Task Manager (`Shift+Esc` or Chrome menu → More Tools → Task Manager)
3. [ ] Load extension popup with 1000+ conversations
4. [ ] Wait for all conversations to load
5. [ ] Note memory usage for "Extension: Chat Memo Pro"
6. [ ] Perform search (fuzzy search with results)
7. [ ] Note memory usage during search
8. [ ] Scroll through conversation list
9. [ ] Open Export Wizard
10. [ ] Note memory usage during wizard

**Measurements**:
- Initial load memory: _________ MB
- During search memory: _________ MB
- During export wizard memory: _________ MB
- **PASS CRITERIA**: All measurements <150MB

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Passed | ❌ Failed
**Notes**: _____________________________________________

---

### T116: Test Search Performance with 1000+ Conversations
**Target**: Search response time <500ms with 1000+ conversations

**Procedure**:
1. [ ] Open extension popup with 1000+ conversations
2. [ ] Open browser DevTools → Console
3. [ ] Run performance test for each search:
   ```javascript
   const start = performance.now();
   // Type search term in search box
   const end = performance.now();
   console.log(`Search time: ${end - start}ms`);
   ```
4. [ ] Test 10 different search queries:
   - [ ] Single word: "python"
   - [ ] Two words: "machine learning"
   - [ ] Typo search: "javasript"
   - [ ] Platform name: "Claude"
   - [ ] Long query: "how to build neural network"
   - [ ] Very short: "ai"
   - [ ] Special chars: "c++"
   - [ ] Common word: "the"
   - [ ] Number: "2024"
   - [ ] Empty → full list

**Measurements**:
Record response time for each query:
1. _______ ms
2. _______ ms
3. _______ ms
4. _______ ms
5. _______ ms
6. _______ ms
7. _______ ms
8. _______ ms
9. _______ ms
10. _______ ms

**Average**: _______ ms
**PASS CRITERIA**: Average <500ms, no query >1000ms

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Passed | ❌ Failed
**Notes**: _____________________________________________

---

### T117: Test Export Performance
**Target**: 100 conversations single doc <10s, multiple files ZIP <30s

**Test 1: Single Merged Document (100 conversations)**

For each format:

1. **Markdown Single**:
   - [ ] Select 100 conversations in export wizard
   - [ ] Mode: Single, Format: Markdown
   - [ ] Start timer when clicking "Start Export"
   - [ ] Stop timer when download prompt appears
   - [ ] Time: _______ seconds
   - [ ] **PASS**: <10 seconds

2. **JSON Single**:
   - [ ] Select 100 conversations
   - [ ] Mode: Single, Format: JSON
   - [ ] Time: _______ seconds
   - [ ] **PASS**: <10 seconds

3. **Plain Text Single**:
   - [ ] Select 100 conversations
   - [ ] Mode: Single, Format: Plain Text
   - [ ] Time: _______ seconds
   - [ ] **PASS**: <10 seconds

**Test 2: Multiple Files ZIP (100 conversations)**

4. **Markdown ZIP**:
   - [ ] Select 100 conversations
   - [ ] Mode: Multiple, Format: Markdown
   - [ ] Time: _______ seconds
   - [ ] **PASS**: <30 seconds

5. **JSON ZIP**:
   - [ ] Select 100 conversations
   - [ ] Mode: Multiple, Format: JSON
   - [ ] Time: _______ seconds
   - [ ] **PASS**: <30 seconds

6. **Plain Text ZIP**:
   - [ ] Select 100 conversations
   - [ ] Mode: Multiple, Format: Plain Text
   - [ ] Time: _______ seconds
   - [ ] **PASS**: <30 seconds

**Verification**:
- [ ] Loading spinner visible during entire export
- [ ] No browser freezing or unresponsiveness
- [ ] Success message appears when complete
- [ ] **PASS CRITERIA**: All single <10s, all ZIP <30s

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Passed | ❌ Failed
**Notes**: _____________________________________________

---

### T118: Verify No Console Errors or Warnings
**Target**: Clean console across all user story scenarios

**Procedure**: During ALL tests above (T109-T117), monitor browser console for errors/warnings

**Scenarios to Check**:
- [ ] Loading extension popup
- [ ] Navigating to Manus.im (adapter initialization)
- [ ] Navigating to Genspark.ai (adapter initialization)
- [ ] Performing fuzzy searches
- [ ] Opening export wizard
- [ ] Selecting time ranges in wizard
- [ ] Selecting modes and formats in wizard
- [ ] Starting export (all formats)
- [ ] Resizing sidebar
- [ ] Scrolling conversation list
- [ ] Clicking on individual conversations
- [ ] Auto-save triggers (on supported platforms)

**Record any console messages**:
- Errors: _____________________________________________
- Warnings: _____________________________________________
- **PASS CRITERIA**: Zero errors, minimal/no warnings (excluding third-party libraries)

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Passed | ❌ Failed
**Notes**: _____________________________________________

---

### T119: Cross-Platform Compatibility Test
**Target**: Works on Chrome 88+ and Edge Chromium

**Chrome Testing**:
1. [ ] Verify Chrome version: chrome://version (must be 88+)
   - Version: _____________
2. [ ] Test all features on Chrome:
   - [ ] Extension loads
   - [ ] Adapters work (Manus, Genspark)
   - [ ] Fuzzy search works
   - [ ] Export wizard works
   - [ ] Sidebar resize works
   - [ ] No visual glitches

**Edge Chromium Testing**:
3. [ ] Verify Edge version: edge://version (Chromium-based)
   - Version: _____________
4. [ ] Load extension in Edge (same unpacked directory)
5. [ ] Test all features on Edge:
   - [ ] Extension loads
   - [ ] Adapters work (Manus, Genspark)
   - [ ] Fuzzy search works
   - [ ] Export wizard works
   - [ ] Sidebar resize works
   - [ ] No visual glitches

**Verification**:
- [ ] No browser-specific bugs
- [ ] Performance consistent across browsers
- [ ] **PASS CRITERIA**: All features work on both Chrome 88+ and Edge Chromium

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Passed | ❌ Failed
**Notes**: _____________________________________________

---

### T120: Verify Vanilla JavaScript Architecture
**Target**: No React/TypeScript/framework dependencies introduced

**Code Review Checklist**:
1. [ ] Check `manifest.json` - verify no new framework libraries added
2. [ ] Review `/js` directory:
   - [ ] All new files use `.js` extension (not `.ts`, `.tsx`, `.jsx`)
   - [ ] No React imports (`import React from 'react'`)
   - [ ] No JSX syntax in code
   - [ ] No TypeScript syntax (interfaces, type annotations)
3. [ ] Review `popup.html`:
   - [ ] No `<script type="module">` or `<script type="text/babel">`
   - [ ] No framework CDN links (React, Vue, Angular)
4. [ ] Check third-party libraries:
   - [ ] Only allowed: Fuse.js (fuzzy search), JSZip (export)
   - [ ] No new framework dependencies
5. [ ] Review new code patterns:
   - [ ] Uses vanilla DOM APIs (querySelector, addEventListener)
   - [ ] Uses plain JavaScript classes/objects
   - [ ] No virtual DOM or reactive frameworks
   - [ ] CSS uses standard classes (no CSS-in-JS libraries)

**Architectural Compliance**:
- [ ] ResizablePanel: Vanilla JS class ✓
- [ ] exportWizard: Plain object with methods ✓
- [ ] Fuzzy search: Uses Fuse.js library (allowed) ✓
- [ ] Export: Uses JSZip library (allowed) ✓
- [ ] No build step required (no webpack, vite, etc.) ✓

**Verification**:
- [ ] Constitution rule respected: "No React, TypeScript, or frameworks"
- [ ] Extension loadable as unpacked without compilation
- [ ] **PASS CRITERIA**: Zero framework dependencies, 100% Vanilla JavaScript

**Status**: ⬜ Not Started | ⏳ In Progress | ✅ Passed | ❌ Failed
**Notes**: _____________________________________________

---

## Summary

**Total Tests**: 12 (T109-T120)
**Completed**: _____ / 12
**Passed**: _____ / 12
**Failed**: _____ / 12

**Overall Status**: ⬜ Not Started | ⏳ In Progress | ✅ All Passed | ❌ Has Failures

**Critical Blockers**:
_____________________________________________

**Nice-to-Have Improvements**:
_____________________________________________

**Ready for Production**: ⬜ Yes | ⬜ No
**Sign-off**: _______________ Date: _______________
