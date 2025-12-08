<!--
Sync Impact Report:
Version: 0.1.0 → 1.0.0
Ratified: 2025-12-08
Modified Principles:
  - NEW: All 5 core principles established
Added Sections:
  - Chrome Extension Requirements
  - Development Workflow
  - Governance
Templates Status:
  ✅ plan-template.md - aligned with constitution principles
  ✅ spec-template.md - aligned with user story requirements
  ✅ tasks-template.md - aligned with phased implementation approach
Follow-up TODOs: None
-->

# Chat Memo Pro Constitution

## Core Principles

### I. Progressive Enhancement & Minimal Disruption

**Requirements:**
- MUST maintain backward compatibility with existing 7 platform adapters (ChatGPT, Claude, Gemini, DeepSeek, Doubao, Kimi, Yuanbao)
- MUST preserve Vanilla JavaScript architecture - NO framework migrations (React/Vue/TypeScript)
- MUST NOT introduce breaking changes to existing 9,442 lines of working code
- MUST add new features as standalone, modular components
- MUST test thoroughly against existing functionality before deployment

**Rationale:**
The extension has 9,442 lines of stable, production-tested code supporting 7 platforms. Framework migrations introduce unnecessary risk, complexity, and development time. Progressive enhancement allows faster iteration and safer deployments.

### II. Chrome Extension Best Practices

**Requirements:**
- MUST follow Manifest V3 standards for all new features
- MUST minimize content script weight - defer heavy libraries to popup/background contexts
- MUST use chrome.storage.local for settings (sync quota: 8KB limit awareness)
- MUST implement CSP-compliant code - NO inline scripts or eval()
- MUST handle permission requests gracefully with user consent
- MUST implement efficient DOM observation with debouncing (default: 300ms)
- MUST respect memory constraints - target <150MB total memory usage
- MUST use IndexedDB for large data storage (conversations)

**Rationale:**
Chrome extensions have strict security policies, memory limits, and performance requirements. Following best practices ensures store approval, user trust, and optimal performance across devices.

### III. Platform Adapter Robustness

**Requirements:**
- MUST implement retry mechanisms for dynamic content loading (max 10 retries, 1s interval)
- MUST use heuristic fallbacks when semantic markup is unavailable
- MUST deduplicate messages before saving (content hash comparison)
- MUST validate conversation URLs before initialization
- MUST provide clear console logging for debugging (prefix: "Keep AI Memory")
- MUST handle SPA navigation and route changes gracefully
- MUST support both semantic selectors and text-based extraction

**Rationale:**
AI platforms frequently update their UI without notice. Robust adapters with multiple extraction strategies ensure resilience. Manus and Genspark represent the complexity spectrum: Manus requires heuristic text analysis (no semantic markup), while Genspark allows standard selector-based extraction.

### IV. User Experience & Accessibility

**Requirements:**
- MUST provide real-time visual feedback (floating indicator: saving/saved states)
- MUST implement responsive design breakpoints (320px min, 800px max)
- MUST support keyboard navigation for all interactive elements
- MUST provide clear error messages with actionable guidance
- MUST respect user preferences (auto-save toggle, position persistence)
- MUST implement loading states for async operations (>500ms)
- MUST ensure WCAG 2.1 Level AA contrast ratios (4.5:1 for normal text)
- MUST localize UI strings using chrome.i18n API

**Rationale:**
Users interact with the extension across diverse contexts and devices. Responsive design, clear feedback, and accessibility ensure broad usability and compliance with accessibility standards.

### V. Data Integrity & Export Flexibility

**Requirements:**
- MUST implement export validation with AND logic (time range + mode + format)
- MUST support multiple export formats: Markdown (with YAML frontmatter), JSON, Plain Text
- MUST follow consistent file naming: `[platform]_[YYYYMMDDHHMMSS]_[title].[ext]`
- MUST provide export preview with conversation count and estimated size
- MUST use JSZip for multi-file exports (maintain existing dependency)
- MUST validate timestamp ranges before filtering (Unix timestamps in milliseconds)
- MUST preserve message metadata: role, content, thinking blocks, timestamps
- MUST sanitize file names (remove special characters: `<>:"/\|?*`)

**Rationale:**
Export is a critical data portability feature. Users need flexible options (time ranges, formats, modes) with clear previews. Consistent formatting ensures compatibility with downstream tools (Obsidian, Notion, Markdown editors).

## Chrome Extension Requirements

### Manifest V3 Compliance
- Service worker-based background script (no persistent background pages)
- Declarative net request API for network modifications
- Promises-based APIs (no callback-style chrome.* methods)
- Host permissions explicitly declared in manifest.json

### Content Script Optimization
- Minimize bundle size - current adapters average ~300 lines each
- Use MutationObserver with debouncing to reduce CPU usage
- Avoid frequent chrome.runtime.sendMessage calls - batch when possible
- Clean up observers on SPA navigation (disconnect before re-initialize)

### Storage Strategy
- chrome.storage.sync: User settings only (max 8KB, 512 items)
- IndexedDB: Conversation data (large, unlimited growth)
- localStorage: UI state only (sidebar width, filter preferences)

### Security Requirements
- Content Security Policy: NO `unsafe-inline`, NO `unsafe-eval`
- All external scripts must be bundled (no CDN references)
- User data encryption at rest (future: optional cloud sync)

## Development Workflow

### Feature Development Phases
1. **Phase 0: Research** - Analyze platform DOM structure, identify selectors
2. **Phase 1: Prototype** - Build minimal adapter with core extraction logic
3. **Phase 2: Testing** - Manual testing across 10+ conversations
4. **Phase 3: Integration** - Add to manifest.json, update platform mappings
5. **Phase 4: Documentation** - Update README, add troubleshooting guide

### Code Review Requirements
- All platform adapters MUST be manually tested before merge
- Export features MUST include file validation tests
- UI changes MUST be tested at 320px, 450px, 800px widths
- Performance MUST be profiled - no >100ms blocking operations

### Testing Standards
- Manual testing checklist for each platform adapter (see analysis document)
- Export validation: verify file naming, frontmatter, content integrity
- Responsive testing: Chrome DevTools device emulation
- Memory profiling: Chrome Task Manager - target <150MB

### Commit Conventions
- Platform adapters: `feat(adapter): add support for [Platform Name]`
- Export features: `feat(export): add [feature description]`
- Bug fixes: `fix(platform): resolve [issue description]`
- UI improvements: `style(ui): improve [component description]`

## Governance

### Amendment Process
1. Identify need for principle change or addition
2. Document rationale with examples from codebase
3. Review against existing principles for conflicts
4. Update constitution.md with version bump:
   - MAJOR: Principle removal or backward-incompatible change
   - MINOR: New principle or material expansion
   - PATCH: Clarification or typo fix
5. Propagate changes to templates (plan, spec, tasks, commands)

### Compliance Verification
- All PRs MUST reference constitution principles in description
- Constitution violations MUST be justified with "Complexity Tracking" section in plan.md
- Templates MUST align with constitution requirements

### Principle Priority
When principles conflict:
1. Progressive Enhancement > New Features (preserve stability)
2. User Experience > Developer Convenience (users first)
3. Data Integrity > Export Speed (correctness over optimization)

### Runtime Guidance
For implementation-specific questions not covered by constitution:
- Reference existing adapters as precedents (7 working examples)
- Consult Chrome extension documentation (developer.chrome.com)
- Follow analysis document recommendations (specs/001-core-enhanced-features/plan.md)

**Version**: 1.0.0 | **Ratified**: 2025-12-08 | **Last Amended**: 2025-12-08
