# TrailNote

AI Tutor + Smart Notes + Minimal Token Tracker for freeCodeCamp.

## Overview

TrailNote is a Chrome extension that provides AI-powered tutoring assistance specifically for freeCodeCamp learners. It reads your current lesson context, offers hints (not answers), and helps you take smart notes with auto-tagging.

## Features

- **AI Tutor**: Context-aware hints and nudges (no full solutions)
- **Smart Notes**: Local note-taking with auto-tags based on lesson content
- **Token Tracker**: Session and daily token usage tracking
- **freeCodeCamp Integration**: Reads challenge titles, URLs, and failing tests
- **Local-first**: All notes and settings stay on your device

## File Structure

```
TrailNote/
├── manifest.json              # Chrome extension manifest (V3)
├── src/
│   ├── background.js          # Service worker for background tasks
│   ├── content.js             # Content script for page interaction
│   ├── panel/
│   │   ├── panel.html         # Side panel UI
│   │   ├── panel.js           # Panel logic
│   │   └── panel.css          # Panel styles
│   └── lib/
│       ├── storage.js         # Chrome storage utilities
│       ├── tokens.js          # Token counting and management
│       ├── tutor.js           # Core tutoring logic
│       ├── context.js         # Conversation context management
│       └── rateLimit.js       # Rate limiting utilities
├── assets/
│   ├── icon16.png            # 16x16 extension icon
│   ├── icon48.png            # 48x48 extension icon
│   └── icon128.png           # 128x128 extension icon
└── README.md
```

## Setup Instructions

### 1. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the TrailNote directory

### 2. Configure Settings

1. Open any page and click the extension icon to open the side panel
2. Navigate to the **Settings** tab
3. Enter your **OpenAI API Key** (required)
4. Choose your **Model** (default: `gpt-4o-mini`)
5. Select **Hint Mode** (strict = no code snippets, expanded = tiny snippets allowed)
6. Click **Save Settings**

### 3. Use the Extension

1. Visit a freeCodeCamp challenge page (e.g., https://www.freecodecamp.org/learn/...)
2. Open the side panel
3. The **Tutor** tab will show the current lesson context and failing tests
4. Click **Explain tests**, **Nudge me**, or **Concept check** for hints
5. Use the **Notes** tab to save learnings with auto-tags
6. Token usage (Session/Today) is displayed at the bottom

### 4. Replace Icons (Optional)

- Replace placeholder icon files in `assets/` with actual PNG icons
- Required sizes: 16x16, 48x48, and 128x128 pixels

## Manual Test Checklist

### Phase 1 — Context Collection
- [ ] Visit a freeCodeCamp challenge page
- [ ] Open the side panel (Tutor tab)
- [ ] Verify challenge title and URL are displayed in "Context Preview"
- [ ] Intentionally fail a test
- [ ] Verify failing test messages appear in Context Preview

### Phase 2 — AI Tutor
- [ ] Without API key: click "Explain tests" → verify error message about missing API key
- [ ] Add API key in Settings tab, click "Save Settings"
- [ ] Click "Explain tests" → verify you get a hint (not full solution)
- [ ] Click "Nudge me" → verify you get guiding questions
- [ ] Click "Concept check" → verify you get a mental model explanation
- [ ] Verify token counters (Session/Today) increment after each request
- [ ] Click a button rapidly → verify rate limiting message appears

### Phase 3 — Notes
- [ ] Navigate to Notes tab
- [ ] Type a note body (e.g., "Flexbox requires display: flex on parent")
- [ ] Add tags (e.g., "#css #flexbox")
- [ ] Click "Save" → verify note appears in list below
- [ ] Type in search box → verify notes filter correctly
- [ ] Check one or more notes
- [ ] Click "Export selected → Markdown" → verify download/new tab with markdown

### Phase 4 — Polish
- [ ] Close and reopen the panel → verify settings persist (API key, model, hint mode)
- [ ] Visit a non-freeCodeCamp page → verify empty state message in Context Preview
- [ ] Remove API key, click tutor button → verify clear error message
- [ ] Verify no console errors in DevTools

## Packaging for Distribution

### For Sharing (Zip)

```bash
# Create a zip file (exclude development files)
zip -r trailnote-v0.2.0.zip . -x "*.git*" "node_modules/*" ".DS_Store" "*.log"
```

### For Chrome Web Store

1. Ensure all placeholder icons are replaced with actual images
2. Test thoroughly using the checklist above
3. Update version in `manifest.json`
4. Create a zip of the entire directory
5. Visit [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
6. Upload the zip and fill in store listing details

## Development Notes

- Uses Manifest V3 with side panel API
- ES6 modules for all JavaScript files
- Content script runs only on `https://www.freecodecamp.org/*`
- All data (notes, settings, tokens) stored locally via `chrome.storage.local`
- Rate limiting: 4 seconds between tutor requests
- OpenAI API called directly from panel (consider proxy for production)

