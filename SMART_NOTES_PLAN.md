# TrailNote — Smart Notes & Concept Check Implementation Plan

## Overview

This plan translates the "Smarter Notes" and "Concept Check companion" documents into actionable todos, organized by priority and dependencies. All features maintain privacy-first, local-storage architecture.

---

## 🚀 TIER 1: Quick Wins (Ship This Week)

### Phase 1A: Note Nugget Structure

**Goal:** Replace free-form notes with structured fields

**Tasks:**
1. Extend note schema to include `fields: { problem, insight, selfCheck }` and `conceptId`
2. Update note composer UI with three guided input fields:
   - Problem (auto-filled from failing test)
   - Insight (one sentence learned)
   - Self-check (yes/no question)
3. Keep optional body field for additional thoughts
4. Migrate legacy notes: wrap existing `body` into `fields.insight`

**Files:** `src/lib/storage.js`, `src/panel/panel.html`, `src/panel/panel.js`

**Estimated time:** 2-3 hours

---

### Phase 1B: One-Tap from Tutor

**Goal:** Save notes directly from tutor answers

**Tasks:**
1. Add "Save as Note" button under every tutor answer
2. Pre-fill note fields:
   - `problem` = top failing test from context
   - `insight` = diagnosis/why from Tutor JSON
   - auto-tags from context (`#semantic-html`, etc.)
3. Add source metadata: `source: {title, url}`

**Files:** `src/panel/panel.js`

**Estimated time:** 1-2 hours

---

### Phase 1C: Concept Stamps & Backlinks

**Goal:** Group related notes by concept

**Tasks:**
1. Create `conceptIdFrom()` slugger function (from failing test text)
2. Attach `conceptId` to each note on save
3. Add "Related notes" section showing other notes with same conceptId
4. Store concept stamps in note schema

**Files:** `src/lib/storage.js`, `src/panel/panel.js`

**Estimated time:** 2 hours

---

### Phase 1D: Inline Checklists

**Goal:** Turn self-checks into actionable checkboxes

**Tasks:**
1. Render checkbox UI for notes with `selfCheck` field
2. Persist checked state in note object: `checklist: {done: boolean}`
3. Show visual indicator for completed checks

**Files:** `src/panel/panel.js`, `src/panel/panel.css`

**Estimated time:** 1 hour

---

### Phase 1E: Smart Resurfacing

**Goal:** Show relevant notes at the right time

**Tasks:**
1. Create per-session map to track surfaced notes: `{conceptId: lastShownAt}`
2. Trigger banner when:
   - URL path or conceptId matches a note
   - Note is older than 24h
   - Note hasn't been surfaced this session
3. Add banner UI: "You saved 2 tips on #semantic-html last time — open?"
4. Hook into context updates

**Files:** `src/panel/panel.js`, `src/panel/panel.html`, `src/panel/panel.css`

**Estimated time:** 2-3 hours

---

### Phase 1F: Faster Capture

**Goal:** Hotkeys and quick snippets

**Tasks:**
1. Add keyboard shortcut: Ctrl/⌘ + Shift + N to open note composer
2. Pre-fill from current context
3. Add snippet expansion in note field:
   - `//tn:gotcha` → "Gotcha: "
   - `//tn:check` → "Self-check: "

**Files:** `src/panel/panel.js`, `manifest.json` (for shortcuts)

**Estimated time:** 1-2 hours

---

### Phase 1G: Quality Nudge

**Goal:** Keep notes atomic and resurfacing-friendly

**Tasks:**
1. Add character counter to insight field (≤120 chars recommended)
2. Show gentle reminder if body length > 280 chars
3. UI copy: "Keep it punchy. Try 1 sentence for insight + 1 for self-check."

**Files:** `src/panel/panel.js`, `src/panel/panel.css`

**Estimated time:** 30 minutes

---

## 🎯 TIER 2: Light AI Assists (Next Sprint)

### Phase 2A: Auto-Summarize (Distill Button)

**Goal:** Convert free-form notes into structured nuggets

**Tasks:**
1. Add "Distill" button on note composer
2. Call LLM with guardrail prompt:
   - Input: user text + failing test
   - Output: `insight` (≤120 chars) + `selfCheck` (≤80 chars)
3. Non-blocking; can edit note after save

**Files:** `src/panel/panel.js`, `src/lib/tutor.js`

**Estimated time:** 2 hours

---

### Phase 2B: Auto-Tagger

**Goal:** Suggest tags from fixed whitelist

**Tasks:**
1. Create whitelist: flexbox, a11y, semantic-html, forms, images, links, lists, etc.
2. Ask model for up to 3 tags from whitelist
3. Cache tags locally (same input → same tags)
4. Show suggested tags on save

**Files:** `src/panel/panel.js`, `src/lib/tutor.js`

**Estimated time:** 1-2 hours

---

### Phase 2C: Flashcard Generator

**Goal:** Convert notes into spaced-repetition cards

**Tasks:**
1. Add "Flashcard" button on note detail view
2. Convert `insight` + `selfCheck` into Q→A card
3. Store as `card: {question, answer, conceptId}`
4. Create "Review" tab with today's due cards
5. Simple spaced-repetition: 1d/3d/7d intervals

**Files:** `src/lib/storage.js`, `src/panel/panel.html`, `src/panel/panel.js`

**Estimated time:** 4-5 hours

---

## 🔮 TIER 3: Smarter Retrieval (Later)

### Phase 3A: Local Search Index

**Goal:** Fuzzy search without cloud

**Tasks:**
1. Maintain keyword index: conceptId + tags + frequent n-grams
2. Search notes by keywords
3. Consider local embedding lib (optional upgrade)

**Files:** `src/lib/storage.js`

**Estimated time:** 3-4 hours

---

### Phase 3B: Note Triggers

**Goal:** Conditional resurfacing rules

**Tasks:**
1. Create trigger store: `{conceptId, condition, coolDownHrs}`
2. Conditions: "visit", "failTestText", "timeSinceSaved"
3. Show banner on trigger match with cooldown

**Files:** `src/lib/storage.js`, `src/panel/panel.js`

**Estimated time:** 2-3 hours

---

### Phase 3C: Bundle Export

**Goal:** Export selected notes as lesson guide

**Tasks:**
1. Add multi-select to note list
2. Export selected notes as Markdown with structure:
   ```
   # Concept Name
   - Problem: ...
   - Insight: ...
   - Self-check: ...
   ```
3. One-click download

**Files:** `src/panel/panel.js`

**Estimated time:** 1-2 hours

---

## 🎨 UI Enhancements (Small, Meaningful)

### Quick Improvements
1. **Note cards:** Show Problem → Insight → Self-check vertically with icons
2. **Filters row:** [All] [Recent] [Has Self-check] [Concept: semantic-html]
3. **Evidence crumb:** Link to "View context" (title + URL)
4. **Success streak:** "You resolved 3 issues tagged #links this week"

**Files:** `src/panel/panel.html`, `src/panel/panel.css`, `src/panel/panel.js`

**Estimated time:** 2-3 hours total

---

## 🔬 CONCEPT CHECK UPGRADES

### Phase CC-1: Concept Library (Static)

**Goal:** Map common FCC failures to concept cards

**Tasks:**
1. Create concept card schema:
   ```ts
   {key, title, level, mentalModel, checklist[], selfCheck, microExercise, prereqs[]}
   ```
2. Add 6-10 core concepts (link-inside-paragraph, alt-text, heading-hierarchy, etc.)
3. Create static library file: `src/lib/concepts.js`

**Files:** `src/lib/concepts.js`

**Estimated time:** 3-4 hours

---

### Phase CC-2: Deterministic Detection

**Goal:** Match failing tests to concepts using rules

**Tasks:**
1. Create detection rules for common patterns
2. Examples:
   - First `<p>` has no `<a>` → `link-inside-first-paragraph`
   - `<img>` missing alt → `alt-text-purpose`
   - First heading is `h2` with no `h1` → `heading-hierarchy`
3. Fall back to LLM classification if no rule matches

**Files:** `src/lib/rules.js`, `src/panel/panel.js`

**Estimated time:** 2-3 hours

---

### Phase CC-3: Concept Check UI

**Goal:** Clean card interface with actions

**Tasks:**
1. Update Concept Check tab to show:
   - Concept title + level badge
   - Mental model (2 lines)
   - Mini-checklist (3 items)
   - Targeted question
   - Micro-exercise (30s action)
2. Add action buttons:
   - "Send to Tutor"
   - "Save as Note"
   - "Try it (30s)"
3. Show progress dot when test passes after viewing

**Files:** `src/panel/panel.html`, `src/panel/panel.js`, `src/panel/panel.css`

**Estimated time:** 3-4 hours

---

### Phase CC-4: Concept Progress Tracking

**Goal:** Track which concepts user has mastered

**Tasks:**
1. Store `ConceptProgress: {key, lastViewedAt, lastPassedAt, confidence}`
2. Update `lastPassedAt` when test passes after viewing concept
3. Show ✓ dot next to mastered concepts
4. Add confidence slider: Low/Med/High
5. Resurface low-confidence concepts after 1 day

**Files:** `src/lib/storage.js`, `src/panel/panel.js`

**Estimated time:** 2-3 hours

---

### Phase CC-5: Stacks & Ladders

**Goal:** Suggest prerequisite concepts when needed

**Tasks:**
1. Add `prereqs[]` to concept schema
2. If concept fails twice, suggest prerequisite
3. Show "Try 'Text vs. Links' first" banner

**Files:** `src/lib/concepts.js`, `src/panel/panel.js`

**Estimated time:** 1-2 hours

---

### Phase CC-6: Concept Compare

**Goal:** Side-by-side comparison for confused concepts

**Tasks:**
1. Add "Compare" button
2. Show 3-row contrast table (e.g., `<a>` vs `<button>` vs `<span role="link">`)
3. Columns: when to use, accessibility note

**Files:** `src/panel/panel.html`, `src/panel/panel.js`, `src/panel/panel.css`

**Estimated time:** 2 hours

---

## 📋 IMPLEMENTATION ORDER (Recommended)

### Week 1: Foundation
1. Phase 1A: Note Nugget Structure ✅
2. Phase 1B: One-Tap from Tutor ✅
3. Phase 1C: Concept Stamps & Backlinks ✅

### Week 2: Core Features
4. Phase 1D: Inline Checklists ✅
5. Phase 1E: Smart Resurfacing ✅
6. Phase CC-1: Concept Library ✅

### Week 3: Polish & Detection
7. Phase 1F: Faster Capture ✅
8. Phase 1G: Quality Nudge ✅
9. Phase CC-2: Deterministic Detection ✅

### Week 4: Concept Check UI
10. Phase CC-3: Concept Check UI ✅
11. Phase CC-4: Concept Progress Tracking ✅

### Sprint 2: AI Assists
12. Phase 2A: Auto-Summarize ✅
13. Phase 2B: Auto-Tagger ✅
14. Phase CC-5: Stacks & Ladders ✅

### Sprint 3: Advanced Features
15. Phase 2C: Flashcard Generator ✅
16. Phase CC-6: Concept Compare ✅
17. UI Enhancements ✅

### Later: Retrieval & Export
18. Phase 3A: Local Search Index
19. Phase 3B: Note Triggers
20. Phase 3C: Bundle Export

---

## 🎯 SUCCESS METRICS

### After Tier 1:
- Notes have structure (problem/insight/self-check)
- 80% of notes created from Tutor
- Users see related notes when relevant
- Notes resurfacing works automatically

### After Tier 2:
- 50% of notes use "Distill" feature
- Auto-tagging reduces manual tagging by 70%
- Users create flashcards from notes

### After Concept Check:
- Users view concept cards before asking Tutor
- 60% of concept checks lead to passed tests
- Concept progress tracked and resurfaced

---

## 🛡️ SAFEGUARDS

1. **No spoilers:** Concept checks never show full code
2. **Privacy-first:** All data stays local (chrome.storage.local)
3. **Minimal tokens:** Use rules first, LLM only for polish/classification
4. **Progressive enhancement:** Each feature works standalone
5. **Backward compatible:** Old notes still work (migrated automatically)

---

## 📝 NOTES

- All phases are independent - can ship in any order
- UI improvements can be sprinkled throughout
- Consider user feedback after each week
- Keep PRs small (1-3 phases per PR)
- Test on real freeCodeCamp challenges after each phase

---

## 🚢 NEXT ACTIONS

1. Review this plan with team/founder
2. Set up project board with todos
3. Start with Phase 1A (Note Nugget Structure)
4. Ship Tier 1 in Week 1-2
5. Gather user feedback
6. Iterate on Tier 2 based on usage data

