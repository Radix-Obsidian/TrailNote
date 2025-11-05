# TrailNote

AI-powered tutoring and learning assistant Chrome extension.

## Overview

TrailNote is a Chrome extension that provides AI-powered tutoring assistance. It helps users learn by answering questions and providing educational support directly in the browser.

## Features

- Side panel interface for easy access
- AI-powered tutoring responses
- Context-aware conversations
- Rate limiting for API usage
- Token management
- Persistent storage

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

1. **Replace Icon Files**
   - Replace the placeholder icon files in `assets/` with actual PNG icons
   - Required sizes: 16x16, 48x48, and 128x128 pixels

2. **Configure API Integration**
   - Edit `src/lib/tutor.js` and implement the `callTutorAPI` function
   - Add your API key and endpoint configuration
   - Update rate limits in `src/lib/rateLimit.js` if needed

3. **Load Extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the TrailNote directory

4. **Use the Extension**
   - Click the extension icon in Chrome toolbar
   - The side panel will open
   - Type questions and interact with the AI tutor

## Development Notes

- The extension uses ES6 modules (import/export)
- All files include basic boilerplate code with TODO comments for implementation
- Storage uses Chrome's local storage API
- Content scripts run on all pages by default (configure in manifest.json if needed)

## Next Steps

1. Implement API integration in `src/lib/tutor.js`
2. Add error handling and user feedback
3. Customize UI/UX in `src/panel/panel.css`
4. Add additional features as needed

