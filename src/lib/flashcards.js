/**
 * HintHopper Flashcard System
 * Converts notes into spaced repetition flashcards
 */

import { store } from './storage.js';

// Constants
const FLASHCARDS_KEY = 'flashcards';
const FLASHCARD_SESSIONS_KEY = 'flashcard_sessions';

// Spaced repetition intervals (in days)
const INTERVALS = [1, 3, 7, 14, 30, 90];

// Default flashcards data
const DEFAULT_FLASHCARDS = {
  // Mapping of flashcard IDs to flashcard data
};

// Default sessions data
const DEFAULT_SESSIONS = {
  // Mapping of session IDs to session data
};

/**
 * The flashcard manager
 */
export const flashcards = {
  /**
   * Get all flashcards
   * @return {Object} The flashcards object
   */
  async getAll() {
    return await store.get(FLASHCARDS_KEY, DEFAULT_FLASHCARDS);
  },
  
  /**
   * Get a specific flashcard by ID
   * @param {string} id - Flashcard ID
   * @return {Object|null} The flashcard object or null if not found
   */
  async get(id) {
    const cards = await this.getAll();
    return cards[id] || null;
  },
  
  /**
   * Create a new flashcard from a note
   * @param {Object} note - The note object
   * @return {Object} The created flashcard
   */
  async createFromNote(note) {
    if (!note || !note.id) {
      throw new Error('Invalid note object');
    }
    
    // Generate flashcard ID
    const id = `fc-${note.id}`;
    
    // Extract front (question) and back (answer) from note fields
    let front = note.fields?.problem || '';
    let back = note.fields?.insight || '';
    
    // If problem is empty, use insight as front
    if (!front && back) {
      front = back;
      back = note.body || '';
    }
    
    // If neither problem nor insight, use first half of body as front
    if (!front && !back && note.body) {
      const midpoint = Math.floor(note.body.length / 2);
      front = note.body.substring(0, midpoint);
      back = note.body.substring(midpoint);
    }
    
    if (!front) {
      throw new Error('Unable to create flashcard: insufficient content');
    }
    
    // Create the flashcard object
    const card = {
      id,
      noteId: note.id,
      front,
      back,
      conceptKey: note.fields?.conceptKey || this._extractConceptKey(note),
      tags: note.tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      
      // Spaced repetition data
      interval: 0, // Current interval index
      nextReview: Date.now(), // Due immediately by default
      easeFactor: 2.5, // Standard ease factor
      reviews: 0, // Number of reviews
      
      // Stats
      correct: 0,
      incorrect: 0
    };
    
    // Save the card
    const cards = await this.getAll();
    cards[id] = card;
    await store.set(FLASHCARDS_KEY, cards);
    
    return card;
  },
  
  /**
   * Update an existing flashcard
   * @param {string} id - Flashcard ID
   * @param {Object} data - Data to update
   * @return {Object} The updated flashcard
   */
  async update(id, data) {
    const cards = await this.getAll();
    
    if (!cards[id]) {
      throw new Error(`Flashcard not found: ${id}`);
    }
    
    // Update the card
    cards[id] = {
      ...cards[id],
      ...data,
      updatedAt: Date.now()
    };
    
    await store.set(FLASHCARDS_KEY, cards);
    return cards[id];
  },
  
  /**
   * Delete a flashcard
   * @param {string} id - Flashcard ID
   * @return {boolean} Success
   */
  async delete(id) {
    const cards = await this.getAll();
    
    if (!cards[id]) {
      return false;
    }
    
    delete cards[id];
    await store.set(FLASHCARDS_KEY, cards);
    return true;
  },
  
  /**
   * Get due flashcards for review
   * @param {number} limit - Maximum number to return
   * @return {Array} Array of due flashcards
   */
  async getDueCards(limit = 10) {
    const cards = await this.getAll();
    const now = Date.now();
    
    const dueCards = Object.values(cards)
      .filter(card => card.nextReview <= now)
      .sort((a, b) => a.nextReview - b.nextReview);
    
    return dueCards.slice(0, limit);
  },
  
  /**
   * Get cards for a specific concept
   * @param {string} conceptKey - The concept key
   * @return {Array} Array of flashcards for the concept
   */
  async getCardsForConcept(conceptKey) {
    if (!conceptKey) return [];
    
    const cards = await this.getAll();
    return Object.values(cards)
      .filter(card => card.conceptKey === conceptKey);
  },
  
  /**
   * Record a review of a flashcard using SM-2 algorithm
   * @param {string} id - Flashcard ID
   * @param {number} quality - Quality of response (0-5)
   *   0 - Complete blackout, wrong answer
   *   1 - Wrong answer, but upon seeing correct answer recognized it
   *   2 - Wrong answer, but correct answer felt familiar
   *   3 - Correct answer, but required significant effort to recall
   *   4 - Correct answer, after some hesitation
   *   5 - Perfect response
   * @return {Object} Updated flashcard data with next review date
   */
  async recordReview(id, quality) {
    const card = await this.get(id);
    if (!card) {
      throw new Error(`Flashcard not found: ${id}`);
    }
    
    // Update stats
    card.reviews++;
    if (quality >= 3) {
      card.correct++;
    } else {
      card.incorrect++;
    }
    
    // Timestamp this review
    const now = Date.now();
    
    // Create review history if it doesn't exist
    if (!card.reviewHistory) {
      card.reviewHistory = [];
    }
    
    // Use SM-2 algorithm to calculate next interval
    // See: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
    
    // 1. Calculate new ease factor (EF)
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    // Where q is quality (0-5), and EF is previous ease factor
    let newEaseFactor = card.easeFactor || 2.5; // Default if not set
    
    newEaseFactor = newEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    
    // Ease factor should remain within bounds
    newEaseFactor = Math.max(1.3, Math.min(2.5, newEaseFactor));
    card.easeFactor = newEaseFactor;
    
    // 2. Calculate next interval
    let nextInterval;
    const repetitionNumber = card.repetitionNumber || 0;
    
    if (quality < 3) {
      // If response quality is less than 3, start repetitions from scratch
      nextInterval = 1; // 1 day
      card.repetitionNumber = 0;
    } else {
      // If quality >= 3, calculate next interval
      card.repetitionNumber = repetitionNumber + 1;
      
      if (card.repetitionNumber === 1) {
        nextInterval = 1; // First successful review: 1 day
      } else if (card.repetitionNumber === 2) {
        nextInterval = 6; // Second successful review: 6 days
      } else {
        // For third and later successful reviews:
        // I(n) = I(n-1) * EF
        const previousInterval = card.currentInterval || 6;
        nextInterval = Math.round(previousInterval * newEaseFactor);
      }
    }
    
    // Store current interval for next calculation
    card.currentInterval = nextInterval;
    
    // Calculate next review date
    const nextReview = now + (nextInterval * 24 * 60 * 60 * 1000);
    card.nextReview = nextReview;
    
    // Add to review history
    card.reviewHistory.push({
      timestamp: now,
      quality,
      interval: nextInterval,
      easeFactor: newEaseFactor
    });
    
    // Limit history size to prevent excessive growth
    if (card.reviewHistory.length > 50) {
      card.reviewHistory = card.reviewHistory.slice(-50);
    }
    
    // Calculate streak
    if (quality >= 3) {
      card.streak = (card.streak || 0) + 1;
    } else {
      card.streak = 0;
    }
    
    // Save changes
    return await this.update(id, card);
  },
  
  /**
   * Start a review session
   * @param {Array} cardIds - Array of card IDs to review
   * @return {Object} Session data
   */
  async startSession(cardIds) {
    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      throw new Error('No cards specified for session');
    }
    
    // Create session ID
    const sessionId = `session-${Date.now()}`;
    
    // Create session object
    const session = {
      id: sessionId,
      startedAt: Date.now(),
      completedAt: null,
      cardIds,
      currentIndex: 0,
      results: {}
    };
    
    // Save session
    const sessions = await store.get(FLASHCARD_SESSIONS_KEY, DEFAULT_SESSIONS);
    sessions[sessionId] = session;
    await store.set(FLASHCARD_SESSIONS_KEY, sessions);
    
    return session;
  },
  
  /**
   * Get the current review session if exists
   * @return {Object|null} Current session or null
   */
  async getCurrentSession() {
    const sessions = await store.get(FLASHCARD_SESSIONS_KEY, DEFAULT_SESSIONS);
    
    // Find the most recent incomplete session
    const incompleteSessions = Object.values(sessions)
      .filter(session => !session.completedAt)
      .sort((a, b) => b.startedAt - a.startedAt);
    
    return incompleteSessions.length > 0 ? incompleteSessions[0] : null;
  },
  
  /**
   * Record result for current card in session
   * @param {string} sessionId - Session ID
   * @param {string} cardId - Card ID
   * @param {boolean} correct - Whether the answer was correct
   * @return {Object} Updated session
   */
  async recordSessionResult(sessionId, cardId, correct) {
    const sessions = await store.get(FLASHCARD_SESSIONS_KEY, DEFAULT_SESSIONS);
    
    if (!sessions[sessionId]) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    const session = sessions[sessionId];
    
    // Record result
    session.results[cardId] = {
      correct,
      timestamp: Date.now()
    };
    
    // Advance to next card
    session.currentIndex++;
    
    // Check if session is complete
    if (session.currentIndex >= session.cardIds.length) {
      session.completedAt = Date.now();
    }
    
    // Save session
    sessions[sessionId] = session;
    await store.set(FLASHCARD_SESSIONS_KEY, sessions);
    
    // Update flashcard with review result
    await this.recordReview(cardId, correct);
    
    return session;
  },
  
  /**
   * Get flashcard stats summary
   * @return {Object} Stats summary
   */
  async getStats() {
    const cards = await this.getAll();
    const cardArray = Object.values(cards);
    
    if (cardArray.length === 0) {
      return {
        total: 0,
        due: 0,
        masteredCount: 0,
        reviewAccuracy: 0,
        avgReviews: 0
      };
    }
    
    const now = Date.now();
    const dueCount = cardArray.filter(card => card.nextReview <= now).length;
    const masteredCount = cardArray.filter(card => card.interval >= 3).length;
    
    let totalReviews = 0;
    let correctReviews = 0;
    
    cardArray.forEach(card => {
      totalReviews += card.reviews;
      correctReviews += card.correct;
    });
    
    return {
      total: cardArray.length,
      due: dueCount,
      masteredCount,
      reviewAccuracy: totalReviews > 0 ? (correctReviews / totalReviews) : 0,
      avgReviews: totalReviews / cardArray.length
    };
  },
  
  /**
   * Extract a concept key from note tags or content
   * @private
   * @param {Object} note - Note object
   * @return {string|null} Concept key
   */
  _extractConceptKey(note) {
    // Try to extract from tags
    if (Array.isArray(note.tags)) {
      for (const tag of note.tags) {
        // Remove # from tag
        const conceptKey = tag.startsWith('#') ? tag.substring(1) : tag;
        
        // Check for some common concept patterns
        if (
          conceptKey.includes('-') || 
          conceptKey.includes('concept') || 
          conceptKey.includes('html') ||
          conceptKey.includes('css')
        ) {
          return conceptKey;
        }
      }
    }
    
    // Try from problem field
    if (note.fields?.problem) {
      // Very simple extraction - in production you'd use a more robust approach
      const words = note.fields.problem
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 3)
        .join('-');
      
      if (words) return words;
    }
    
    return 'general-concept';
  }
};

export default flashcards;
