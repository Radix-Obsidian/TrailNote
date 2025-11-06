/**
 * Struggle Detector - TrailNote v2.0
 * Monitors user behavior to detect when they're stuck and need help
 * without being intrusive or giving away answers
 */

export class StruggleDetector {
  constructor() {
    this.state = {
      explainClickCount: 0,
      nudgeClickCount: 0,
      conceptClickCount: 0,
      lastExplainTime: 0,
      lastNudgeTime: 0,
      sameTestAttempts: 0,
      lastTestContent: '',
      lastConceptId: '',
      timeOnCurrentTest: 0,
      currentTestStartTime: Date.now(),
      chatOpenedManually: false,
      lastStruggleLevel: 'none',
      sessionStartTime: Date.now()
    };
    
    this.thresholds = {
      explainClicksShortWindow: 2,  // 2 clicks in 5 min = gentle help
      explainClicksMediumWindow: 3, // 3 clicks in 10 min = active help
      sameTestAttempts: 3,           // Same test fails 3 times
      timeThreshold: 5 * 60 * 1000,  // 5 minutes
      mediumTimeThreshold: 10 * 60 * 1000 // 10 minutes
    };
    
    this.encouragementMessages = {
      gentle: [
        "I notice you're working through this challenge. Want to talk about it?",
        "Taking your time to understand? That's great! Need a sounding board?",
        "I'm here if you want to discuss your approach!",
        "Learning takes patience. Want to think through this together?"
      ],
      active: [
        "It looks like this concept might be tricky. Let's break it down together!",
        "Stuck on something specific? Sometimes talking it through helps!",
        "I can see you're putting in effort. Want to explore this from a different angle?",
        "This is a good learning opportunity. Let's work through it step by step!"
      ],
      supportive: [
        "You're not alone in finding this challenging! Let's figure it out together.",
        "Great persistence! Sometimes we need to approach problems differently.",
        "This is a tough one! Let's talk through what you're trying to achieve.",
        "You're learning! Want me to help you think through this systematically?"
      ]
    };
  }

  /**
   * Track button clicks (explain, nudge, concept check)
   */
  trackAction(actionType, context = {}) {
    const now = Date.now();
    
    switch(actionType) {
      case 'explain':
        this.state.explainClickCount++;
        this.state.lastExplainTime = now;
        break;
      case 'nudge':
        this.state.nudgeClickCount++;
        this.state.lastNudgeTime = now;
        break;
      case 'concept':
        this.state.conceptClickCount++;
        break;
      case 'context_change':
        this.handleContextChange(context);
        break;
      case 'chat_opened':
        this.state.chatOpenedManually = true;
        break;
      case 'success':
        this.handleSuccess();
        break;
    }
    
    return this.analyzeStruggleLevel();
  }

  /**
   * Handle when context/challenge changes
   */
  handleContextChange(newContext) {
    const currentTest = newContext.failingTests?.[0] || '';
    const currentConceptId = newContext.conceptId || '';
    
    // Check if it's the same test
    if (currentTest === this.state.lastTestContent) {
      this.state.sameTestAttempts++;
      this.state.timeOnCurrentTest = Date.now() - this.state.currentTestStartTime;
    } else {
      // New test - reset some counters but keep session awareness
      this.state.sameTestAttempts = 1;
      this.state.lastTestContent = currentTest;
      this.state.currentTestStartTime = Date.now();
      this.state.timeOnCurrentTest = 0;
      
      // If concept changed, reset concept-specific counters
      if (currentConceptId !== this.state.lastConceptId) {
        this.state.lastConceptId = currentConceptId;
        this.state.explainClickCount = 0;
        this.state.nudgeClickCount = 0;
        this.state.conceptClickCount = 0;
      }
    }
  }

  /**
   * Handle when user succeeds
   */
  handleSuccess() {
    // Gentle reset - keep session memory but acknowledge progress
    this.state.sameTestAttempts = 0;
    this.state.explainClickCount = Math.max(0, this.state.explainClickCount - 1);
    this.state.nudgeClickCount = Math.max(0, this.state.nudgeClickCount - 1);
  }

  /**
   * Analyze current struggle level
   * Returns: { level: 'none'|'gentle'|'active'|'supportive', shouldShowChat: boolean, message: string }
   */
  analyzeStruggleLevel() {
    const now = Date.now();
    const timeSinceSessionStart = now - this.state.sessionStartTime;
    
    // Don't intervene too early in the session
    if (timeSinceSessionStart < 30 * 1000) { // First 30 seconds
      return { level: 'none', shouldShowChat: false, message: '' };
    }
    
    // Calculate indicators
    const recentExplainClicks = this.getRecentClickCount('explain', this.thresholds.timeThreshold);
    const recentNudgeClicks = this.getRecentClickCount('nudge', this.thresholds.timeThreshold);
    const totalRecentClicks = recentExplainClicks + recentNudgeClicks;
    
    const timeOnTest = this.state.timeOnCurrentTest;
    const sameTestAttempts = this.state.sameTestAttempts;
    
    // Calculate struggle level
    let level = 'none';
    let shouldShowChat = false;
    
    // Supportive level (highest intervention)
    if (
      totalRecentClicks >= 4 ||
      sameTestAttempts >= 5 ||
      (timeOnTest > 8 * 60 * 1000 && totalRecentClicks >= 2)
    ) {
      level = 'supportive';
      shouldShowChat = true;
    }
    // Active level (moderate intervention)
    else if (
      totalRecentClicks >= 3 ||
      sameTestAttempts >= 3 ||
      (timeOnTest > 5 * 60 * 1000 && totalRecentClicks >= 1)
    ) {
      level = 'active';
      shouldShowChat = true;
    }
    // Gentle level (soft intervention)
    else if (
      totalRecentClicks >= 2 ||
      sameTestAttempts >= 2 ||
      timeOnTest > 3 * 60 * 1000
    ) {
      level = 'gentle';
      shouldShowChat = false; // Don't auto-show, just make available
    }
    
    // Manual override if user opened chat
    if (this.state.chatOpenedManually) {
      shouldShowChat = true;
    }
    
    const message = this.getEncouragementMessage(level);
    this.state.lastStruggleLevel = level;
    
    return {
      level,
      shouldShowChat,
      message,
      indicators: {
        recentClicks: totalRecentClicks,
        sameTestAttempts,
        timeOnTest: Math.round(timeOnTest / 1000 / 60) // minutes
      }
    };
  }

  /**
   * Get count of recent clicks within a time window
   */
  getRecentClickCount(actionType, timeWindow) {
    const now = Date.now();
    switch(actionType) {
      case 'explain':
        if (now - this.state.lastExplainTime < timeWindow) {
          return this.state.explainClickCount;
        }
        break;
      case 'nudge':
        if (now - this.state.lastNudgeTime < timeWindow) {
          return this.state.nudgeClickCount;
        }
        break;
    }
    return 0;
  }

  /**
   * Get random encouragement message for current level
   */
  getEncouragementMessage(level) {
    if (level === 'none') return '';
    
    const messages = this.encouragementMessages[level] || this.encouragementMessages.gentle;
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Get state snapshot for debugging
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Reset session (used when extension reopens or user completes a series)
   */
  resetSession() {
    this.state = {
      explainClickCount: 0,
      nudgeClickCount: 0,
      conceptClickCount: 0,
      lastExplainTime: 0,
      lastNudgeTime: 0,
      sameTestAttempts: 0,
      lastTestContent: '',
      lastConceptId: '',
      timeOnCurrentTest: 0,
      currentTestStartTime: Date.now(),
      chatOpenedManually: false,
      lastStruggleLevel: 'none',
      sessionStartTime: Date.now()
    };
  }

  /**
   * Soft reset (after success or taking a break)
   */
  softReset() {
    this.state.sameTestAttempts = 0;
    this.state.explainClickCount = Math.max(0, this.state.explainClickCount - 1);
    this.state.nudgeClickCount = Math.max(0, this.state.nudgeClickCount - 1);
  }
}

// Export singleton instance
export const struggleDetector = new StruggleDetector();
