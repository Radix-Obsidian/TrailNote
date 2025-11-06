# TrailNote UI Redesign Specification
## Spec-Driven Implementation Plan v1.0

**Objective:** Redesign TrailNote UI following OpenAI ChatGPT and Apple Human Interface Guidelines principles, adding continuous error handling tutor, and improving overall user experience.

---

## 🎯 Design Principles

### Core Philosophy
1. **Clarity over Cleverness** - Every element has clear purpose
2. **Progressive Disclosure** - Show what's needed, hide complexity
3. **Spatial Consistency** - Predictable layout and spacing
4. **Responsive Feedback** - Every action has immediate visual response
5. **Graceful Learning Curve** - Guide users naturally through features

### Visual Language (Apple HIG + OpenAI)
- **Typography**: SF Pro Display (system font fallback)
- **Spacing**: 4px base unit (4, 8, 12, 16, 24, 32, 48, 64px)
- **Radius**: 8px standard, 12px cards, 16px modals
- **Shadows**: Subtle elevation (0 2px 8px rgba(0,0,0,0.08))
- **Colors**: System colors with semantic meaning

---

## 📐 Layout Architecture

### New Three-Column Layout
```
┌──────────────────────────────────────────────────────┐
│  Header (Fixed)                                      │
├──────────────┬───────────────────┬───────────────────┤
│   Sidebar    │   Main Content    │   Assistant Panel │
│   (Fixed)    │   (Scrollable)    │   (Collapsible)   │
│              │                   │                   │
│  • Tutor     │  Context Preview  │   Chat Window     │
│  • Notes     │  + Actions        │   (Continuous     │
│  • Settings  │  + Answer         │    Help Mode)     │
│              │                   │                   │
│  Quick       │  Note Composer    │   Related Notes   │
│  Actions     │  or               │   or              │
│  Panel       │  Settings Panel   │   Help Context    │
└──────────────┴───────────────────┴───────────────────┘
```

### Responsive Behavior
- **Width > 900px**: Full three-column layout
- **Width 600-900px**: Hide assistant panel, show as overlay
- **Width < 600px**: Stack vertically, sidebar as drawer

---

## 🆕 New Feature: Continuous Error Handling Chat

### Concept
A persistent chat interface that activates when users show signs of struggle, providing encouragement and guidance without giving away answers.

### Trigger Conditions
1. User clicks "Explain tests" more than 2 times in 5 minutes
2. Same failing test persists for > 3 attempts
3. User manually opens chat via button
4. Context switches but progress isn't made

### Chat Behavior
```javascript
// Engagement levels based on struggle indicators
const chatModes = {
  dormant: "Hidden, monitoring only",
  gentle: "Soft encouragement, clarifying questions",
  active: "Socratic questioning, concept checks",
  supportive: "Break down the problem, suggest resources"
}
```

### UI Components
```
┌─────────────────────────────────────┐
│ 💬 Learning Assistant               │
│                          [Minimize] │
├─────────────────────────────────────┤
│ 🤖: I notice you're working on      │
│     semantic HTML. Want to talk     │
│     through your approach?          │
│                                     │
│ 👤: [Type your question...]         │
│     [Send] [I figured it out!]      │
├─────────────────────────────────────┤
│ Quick Actions:                      │
│ • Show me a hint                    │
│ • Explain this concept              │
│ • I need a break                    │
└─────────────────────────────────────┘
```

---

## 🎨 Component Specifications

### 1. Header Component
**Purpose**: Brand identity + status indicators

```css
.header-redesign {
  height: 56px;
  padding: 0 20px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.brand-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
```

### 2. Sidebar Navigation
**Purpose**: Primary navigation with clear hierarchy

```css
.sidebar {
  width: 240px;
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: #f3f4f6;
  color: #374151;
}

.nav-item.active {
  background: #e0e7ff;
  color: #4f46e5;
}

.nav-icon {
  width: 20px;
  height: 20px;
  opacity: 0.7;
}

.nav-item.active .nav-icon {
  opacity: 1;
}
```

### 3. Main Content Area
**Purpose**: Primary workspace with clear visual hierarchy

```css
.main-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  background: #ffffff;
}

.content-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}
```

### 4. Assistant Panel (Collapsible)
**Purpose**: Contextual help and related information

```css
.assistant-panel {
  width: 320px;
  background: #f9fafb;
  border-left: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.3s ease;
}

.assistant-panel.collapsed {
  width: 0;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
```

### 5. Chat Interface Component
**Purpose**: Continuous learning support

```css
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
}

.chat-header {
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-message {
  display: flex;
  gap: 12px;
  max-width: 80%;
}

.chat-message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
}

.message-bubble {
  background: #f3f4f6;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.5;
}

.chat-message.user .message-bubble {
  background: #4f46e5;
  color: white;
}

.chat-input-area {
  padding: 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 8px;
}

.chat-input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: #4f46e5;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  background: #f9fafb;
}

.quick-action-btn {
  padding: 6px 12px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-action-btn:hover {
  background: #f3f4f6;
  border-color: #4f46e5;
}
```

### 6. Button System
**Purpose**: Clear action hierarchy

```css
/* Primary actions */
.btn-primary {
  padding: 10px 20px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #4338ca;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

/* Secondary actions */
.btn-secondary {
  padding: 10px 20px;
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

/* Icon buttons */
.btn-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: #f3f4f6;
}
```

---

## 🔧 Implementation Phases

### Phase A: Foundation (Day 1-2)
**Goal**: Set up new layout structure without breaking existing functionality

**Tasks**:
1. Create new CSS architecture with design tokens
2. Build grid layout system (sidebar + main + assistant panel)
3. Implement responsive breakpoints
4. Add smooth transitions

**Files**:
- `src/panel/panel-v2.css` (new design system)
- `src/panel/layout.css` (grid system)

**Acceptance Criteria**:
- [ ] Three-column layout renders correctly
- [ ] Responsive behavior works at all breakpoints
- [ ] All existing content fits in new structure
- [ ] No functionality is broken

---

### Phase B: Chat Interface (Day 3-4)
**Goal**: Build continuous error handling chat system

**Tasks**:
1. Create chat UI component
2. Build message display system
3. Implement struggle detection logic
4. Add chat interaction handlers
5. Create chat context management

**Files**:
- `src/panel/components/chat.js`
- `src/panel/components/chat.css`
- `src/lib/struggle-detector.js`

**Data Structures**:
```javascript
// Chat message format
{
  id: string,
  role: 'assistant' | 'user',
  content: string,
  timestamp: number,
  context: {
    currentTest: string,
    attemptCount: number,
    conceptId: string
  }
}

// Struggle indicators
{
  explainClickCount: number,
  lastExplainTime: number,
  sameTestAttempts: number,
  lastTestContent: string,
  timeOnCurrentTest: number,
  chatOpenedManually: boolean
}
```

**Acceptance Criteria**:
- [ ] Chat window appears/hides smoothly
- [ ] Messages display with proper formatting
- [ ] Struggle detection triggers correctly
- [ ] Chat maintains conversation context
- [ ] Quick actions work as expected

---

### Phase C: Component Migration (Day 5-6)
**Goal**: Migrate existing components to new design system

**Tasks**:
1. Redesign tutor section buttons and layout
2. Migrate note composer to card-based UI
3. Rebuild settings panel with better organization
4. Update context preview styling
5. Enhance note list with better visual hierarchy

**Components to Update**:
- Action buttons (Explain, Nudge, Concept Check)
- Note composer form
- Note list display
- Settings panel
- Context preview

**Acceptance Criteria**:
- [ ] All components follow new design system
- [ ] Improved visual hierarchy and spacing
- [ ] Better touch targets (min 44x44px)
- [ ] Smooth animations on interactions
- [ ] Proper loading and error states

---

### Phase D: Smart Features (Day 7-8)
**Goal**: Enhance smart resurfacing and add contextual intelligence

**Tasks**:
1. Improve resurfacing banner design
2. Add chat integration with notes
3. Implement smart suggestions in chat
4. Add progress indicators
5. Create onboarding tooltips

**New Features**:
- Chat can reference and create notes
- Assistant suggests concept checks
- Visual progress tracking
- Contextual help in chat
- First-time user guidance

**Acceptance Criteria**:
- [ ] Resurfacing integrates with chat
- [ ] Chat can trigger note creation
- [ ] Progress indicators are clear
- [ ] Onboarding is helpful not intrusive
- [ ] All features work together seamlessly

---

### Phase E: Polish & Testing (Day 9-10)
**Goal**: Refinement, accessibility, and performance

**Tasks**:
1. Add animations and micro-interactions
2. Implement keyboard shortcuts for chat
3. Add accessibility features (ARIA labels, focus management)
4. Performance optimization
5. Cross-browser testing
6. User testing and feedback

**Focus Areas**:
- Smooth animations (60fps)
- Keyboard navigation
- Screen reader support
- Loading states
- Error handling
- Edge cases

**Acceptance Criteria**:
- [ ] WCAG 2.1 AA compliant
- [ ] Keyboard accessible
- [ ] Smooth 60fps animations
- [ ] No visual glitches
- [ ] Works in Chrome, Firefox, Edge
- [ ] Mobile responsive

---

## 📊 Success Metrics

### User Experience
- Time to first action < 3 seconds
- Task completion rate > 90%
- User confusion events < 5%
- Chat engagement rate > 40%

### Technical Performance
- First paint < 100ms
- Interaction response < 16ms (60fps)
- Memory usage < 50MB
- CSS bundle < 30KB

### Feature Adoption
- Chat usage in struggle situations > 60%
- Note creation from chat > 30%
- Return to chat after success > 20%

---

## 🎨 Design Tokens

```css
:root {
  /* Colors - Primary */
  --color-primary-50: #f5f3ff;
  --color-primary-100: #ede9fe;
  --color-primary-500: #8b5cf6;
  --color-primary-600: #7c3aed;
  --color-primary-700: #6d28d9;
  
  /* Colors - Semantic */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
  
  /* Typography */
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: 'SF Mono', 'Monaco', 'Consolas', monospace;
  
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* Borders */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.12);
}
```

---

## 🚀 Quick Start Implementation

### Step 1: Create New Files
```bash
src/panel/
  ├── v2/
  │   ├── layout.css          # Grid system
  │   ├── tokens.css          # Design tokens
  │   ├── components.css      # Shared components
  │   ├── chat.css           # Chat interface
  │   └── chat.js            # Chat logic
  └── lib/
      └── struggle-detector.js
```

### Step 2: Feature Flags
Add feature flag to enable v2 UI progressively:
```javascript
const UI_VERSION = localStorage.getItem('ui_version') || 'v1';
if (UI_VERSION === 'v2') {
  import('./panel/v2/layout.css');
  import('./panel/v2/chat.js');
}
```

### Step 3: Gradual Migration
- Phase A: Layout only
- Phase B: Add chat
- Phase C: Migrate components one by one
- Phase D: Enable by default
- Phase E: Remove v1 code

---

## 📝 Notes & Considerations

### Backward Compatibility
- Maintain all existing keyboard shortcuts
- Preserve all data structures
- Support gradual feature adoption
- Allow users to toggle between UIs during transition

### Performance Budget
- Total CSS: < 50KB gzipped
- Total JS: < 100KB gzipped
- Initial render: < 100ms
- Interaction response: < 16ms

### Accessibility Requirements
- WCAG 2.1 AA minimum
- Keyboard navigation for all features
- Screen reader tested
- Focus indicators on all interactive elements
- Color contrast ratios > 4.5:1

---

## ✅ Checklist for Going Live

- [ ] All phases completed
- [ ] User testing with 5+ users
- [ ] Accessibility audit passed
- [ ] Performance metrics met
- [ ] Cross-browser testing done
- [ ] Documentation updated
- [ ] Migration guide written
- [ ] Rollback plan in place
- [ ] Feature flags configured
- [ ] Analytics tracking added

---

**Document Version**: 1.0  
**Created**: 2025-11-05  
**Last Updated**: 2025-11-05  
**Status**: Ready for Implementation
