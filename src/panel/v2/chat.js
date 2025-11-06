/**
 * Chat Interface - TrailNote v2.0
 * Manages the continuous learning assistant chat
 */

import { struggleDetector } from '../../lib/struggle-detector.js';
import { tutorAnswer } from '../../lib/tutor.js';

export class ChatInterface {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.messages = [];
    this.isOpen = false;
    this.isTyping = false;
    this.currentContext = null;
    
    this.options = {
      autoShow: true,
      persistMessages: true,
      maxMessages: 100,
      ...options
    };
    
    this.init();
  }

  init() {
    this.render();
    this.attachEventListeners();
    this.loadMessages();
  }

  render() {
    this.container.innerHTML = `
      <div class="chat-container">
        <div class="chat-header">
          <div class="chat-title">Learning Assistant</div>
          <div class="chat-controls">
            <button class="chat-control-btn" id="chatMinimize" title="Close">
              ×
            </button>
          </div>
        </div>
        
        <div class="chat-messages" id="chatMessages">
          <div class="chat-empty-state">
            <div class="chat-empty-title">Ready when you are.</div>
          </div>
        </div>
        
        <div class="chat-input-container">
          <div class="quick-actions-dropdown" id="quickActionsDropdown">
            <div class="quick-action-item" data-action="hint">
              <span class="quick-action-icon">💡</span>
              <span>Get a hint</span>
            </div>
            <div class="quick-action-item" data-action="concept">
              <span class="quick-action-icon">📚</span>
              <span>Explain concept</span>
            </div>
            <div class="quick-action-item" data-action="approach">
              <span class="quick-action-icon">🎯</span>
              <span>Show approach</span>
            </div>
            <div class="quick-action-divider"></div>
            <div class="quick-action-item" data-action="encourage">
              <span class="quick-action-icon">🌟</span>
              <span>Encourage me</span>
            </div>
          </div>
          
          <div class="chat-input-wrapper">
            <button class="chat-plus-btn" id="chatPlusBtn">+</button>
            <textarea 
              class="chat-input" 
              id="chatInput" 
              placeholder="Ask anything"
              rows="1"
            ></textarea>
            <div class="chat-input-actions">
              <button class="chat-action-btn" id="chatVoiceBtn" title="Voice input">
                🎤
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    const input = document.getElementById('chatInput');
    const minimizeBtn = document.getElementById('chatMinimize');
    const plusBtn = document.getElementById('chatPlusBtn');
    const dropdown = document.getElementById('quickActionsDropdown');
    
    // Auto-resize textarea
    input?.addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    });
    
    // Send message on Enter (Shift+Enter for new line)
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (e.target.value.trim()) {
          this.sendMessage();
        }
      }
    });
    
    // Minimize button
    minimizeBtn?.addEventListener('click', () => this.minimize());
    
    // Plus button dropdown toggle
    plusBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.quick-actions-dropdown') && !e.target.closest('.chat-plus-btn')) {
        dropdown?.classList.remove('open');
      }
    });
    
    // Handle quick action clicks
    dropdown?.addEventListener('click', (e) => {
      const item = e.target.closest('.quick-action-item');
      if (item) {
        const action = item.dataset.action;
        this.handleQuickAction(action);
        dropdown.classList.remove('open');
      }
    });
  }

  async sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input?.value.trim();
    
    if (!message) return;
    
    // Add user message
    this.addMessage({
      role: 'user',
      content: message,
      timestamp: Date.now()
    });
    
    // Clear input
    input.value = '';
    input.style.height = 'auto';
    
    // Show typing indicator
    this.showTyping();
    
    // Get assistant response
    try {
      const response = await this.getAssistantResponse(message);
      this.hideTyping();
      this.addMessage({
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });
    } catch (error) {
      this.hideTyping();
      this.addMessage({
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again!",
        timestamp: Date.now()
      });
    }
  }

  async getAssistantResponse(userMessage) {
    // Use the tutor system with chat context
    const chatContext = {
      ...this.currentContext,
      chatMode: true,
      userQuestion: userMessage,
      recentMessages: this.messages.slice(-5) // Last 5 messages for context
    };
    
    try {
      // tutorAnswer(mode, context, tone)
      const response = await tutorAnswer('nudge', chatContext, 'nudge');
      return response.answer || "I'm here to help! Can you tell me more about what you're working on?";
    } catch (error) {
      console.error('Chat error:', error);
      return this.getFallbackResponse(userMessage);
    }
  }

  getFallbackResponse(message) {
    // Simple pattern matching for common questions when API is unavailable
    const lower = message.toLowerCase();
    
    if (lower.includes('stuck') || lower.includes('help')) {
      return "Let's think through this together. What part of the challenge is confusing? Can you describe what you're trying to do?";
    }
    if (lower.includes('how') || lower.includes('approach')) {
      return "Good question! Let's break it down. First, what do you think the problem is asking for? What's the goal?";
    }
    if (lower.includes('why')) {
      return "Great question - understanding the 'why' is important! Can you share the specific part you're curious about?";
    }
    if (lower.includes('error') || lower.includes('wrong')) {
      return "Errors are learning opportunities! What's the error message telling you? Let's decode it together.";
    }
    
    return "I'm listening! Tell me more about what you're working on, and I'll help guide you.";
  }

  addMessage(message) {
    this.messages.push(message);
    
    // Limit message history
    if (this.messages.length > this.options.maxMessages) {
      this.messages = this.messages.slice(-this.options.maxMessages);
    }
    
    this.renderMessages();
    this.saveMessages();
  }

  renderMessages() {
    const messagesContainer = document.getElementById('chatMessages');
    
    if (this.messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="chat-empty-state">
          <div class="chat-empty-title">Ready when you are.</div>
        </div>
      `;
      return;
    }
    
    messagesContainer.innerHTML = this.messages.map(msg => this.renderMessage(msg)).join('');
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  renderMessage(message) {
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const avatar = message.role === 'assistant' ? '🤖' : '👤';
    
    return `
      <div class="chat-message ${message.role}">
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
          <div class="message-bubble">${this.formatMessage(message.content)}</div>
          <div class="message-time">${time}</div>
        </div>
      </div>
    `;
  }

  formatMessage(content) {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="code-inline">$1</code>')
      .replace(/\n/g, '<br>');
  }

  showTyping() {
    const messagesContainer = document.getElementById('chatMessages');
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'chat-message assistant';
    typingIndicator.id = 'typingIndicator';
    typingIndicator.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    messagesContainer.appendChild(typingIndicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    this.isTyping = true;
  }

  hideTyping() {
    const indicator = document.getElementById('typingIndicator');
    indicator?.remove();
    this.isTyping = false;
  }

  async handleQuickAction(action) {
    const actions = {
      hint: "Can you give me a hint without showing the solution?",
      concept: "Can you explain the key concept I need to understand here?",
      approach: "How should I approach solving this problem?",
      encourage: "I'm feeling stuck. Can you encourage me?"
    };
    
    const message = actions[action];
    if (message) {
      document.getElementById('chatInput').value = message;
      await this.sendMessage();
    }
  }

  showStruggleBanner(struggleInfo) {
    const messagesContainer = document.getElementById('chatMessages');
    
    // Remove existing banner
    const existingBanner = messagesContainer.querySelector('.struggle-banner');
    if (existingBanner) existingBanner.remove();
    
    const banner = document.createElement('div');
    banner.className = 'struggle-banner';
    banner.innerHTML = `
      <div class="struggle-banner-icon">🤗</div>
      <div class="struggle-banner-content">
        <div class="struggle-banner-title">I'm here to help!</div>
        <div class="struggle-banner-message">${struggleInfo.message}</div>
      </div>
      <button class="struggle-banner-action">Let's talk</button>
    `;
    
    banner.querySelector('.struggle-banner-action').addEventListener('click', () => {
      banner.remove();
      this.addMessage({
        role: 'assistant',
        content: struggleInfo.message,
        timestamp: Date.now()
      });
      document.getElementById('chatInput').focus();
    });
    
    messagesContainer.insertBefore(banner, messagesContainer.firstChild);
  }

  updateContext(context) {
    this.currentContext = context;
  }

  show() {
    this.isOpen = true;
    this.container.style.display = 'block';
  }

  hide() {
    this.isOpen = false;
    this.container.style.display = 'none';
  }

  minimize() {
    this.hide();
  }

  saveMessages() {
    if (this.options.persistMessages) {
      try {
        localStorage.setItem('trailnote_chat_messages', JSON.stringify(this.messages));
      } catch (e) {
        console.warn('Failed to save chat messages:', e);
      }
    }
  }

  loadMessages() {
    if (this.options.persistMessages) {
      try {
        const saved = localStorage.getItem('trailnote_chat_messages');
        if (saved) {
          this.messages = JSON.parse(saved);
          this.renderMessages();
        }
      } catch (e) {
        console.warn('Failed to load chat messages:', e);
      }
    }
  }

  clearHistory() {
    this.messages = [];
    this.renderMessages();
    this.saveMessages();
  }
}

export function initChat(containerEl, options) {
  return new ChatInterface(containerEl, options);
}
