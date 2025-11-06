/**
 * HintHopper Flashcard Manager
 * Handles flashcard UI, creation, and review
 */

import { flashcards } from '../../lib/flashcards.js';

// Current state
let currentSession = null;
let currentCardIndex = 0;
let reviewCards = [];
let isCardFlipped = false;

/**
 * Initialize flashcard interface
 * @param {HTMLElement} container - The flashcard content container
 */
export async function initFlashcards(container) {
  if (!container) return;
  
  try {
    await updateFlashcardStats();
    await renderFlashcardsList();
    setupEventListeners();
  } catch (error) {
    console.error('[HintHopper] Error initializing flashcards:', error);
    container.innerHTML = `
      <div class="alert alert-error">
        <div class="alert-content">
          <div class="alert-message">Error loading flashcards. Please try again later.</div>
        </div>
      </div>
    `;
  }
}

/**
 * Update the flashcard statistics display
 */
export async function updateFlashcardStats() {
  const statsContainer = document.querySelector('.flashcards-stats');
  if (!statsContainer) return;
  
  try {
    // Get stats from flashcard system
    const stats = await flashcards.getStats();
    const dueCards = await flashcards.getDueCards(100); // Just to get count
    
    // Update due cards count in navigation
    const dueCardsCount = document.getElementById('dueCardsCount');
    if (dueCardsCount) {
      dueCardsCount.textContent = dueCards.length.toString();
      dueCardsCount.style.display = dueCards.length > 0 ? 'inline-flex' : 'none';
    }
    
    // Show or hide review button based on due cards
    const startReviewBtn = document.getElementById('startReviewBtn');
    if (startReviewBtn) {
      startReviewBtn.style.display = dueCards.length > 0 ? 'inline-flex' : 'none';
    }
    
    // If no flashcards yet, show empty state
    if (stats.total === 0) {
      statsContainer.innerHTML = `
        <div class="flashcards-empty">
          <h3>No Flashcards Yet</h3>
          <p>Turn your notes into flashcards to reinforce your learning.</p>
          <p>Click the "New" button to create your first flashcard, or add the "Make Flashcard" option when saving notes.</p>
        </div>
      `;
      return;
    }
    
    // Otherwise show stats
    statsContainer.innerHTML = `
      <div class="flashcard-stat">
        <div class="flashcard-stat-number">${stats.total}</div>
        <div class="flashcard-stat-label">Total Cards</div>
      </div>
      <div class="flashcard-stat">
        <div class="flashcard-stat-number">${stats.due}</div>
        <div class="flashcard-stat-label">Due Today</div>
      </div>
      <div class="flashcard-stat">
        <div class="flashcard-stat-number">${stats.masteredCount}</div>
        <div class="flashcard-stat-label">Mastered</div>
      </div>
      <div class="flashcard-stat">
        <div class="flashcard-stat-number">${Math.round(stats.reviewAccuracy * 100)}%</div>
        <div class="flashcard-stat-label">Accuracy</div>
      </div>
    `;
  } catch (error) {
    console.error('[HintHopper] Error updating flashcard stats:', error);
    statsContainer.innerHTML = `
      <div class="alert alert-error">
        <div class="alert-content">
          <div class="alert-message">Error loading flashcard statistics.</div>
        </div>
      </div>
    `;
  }
}

/**
 * Render the list of flashcards
 */
export async function renderFlashcardsList() {
  const listContainer = document.getElementById('flashcardsList');
  if (!listContainer) return;
  
  try {
    const allCards = await flashcards.getAll();
    const cardArray = Object.values(allCards);
    const now = Date.now();
    
    // If no cards, show empty state
    if (cardArray.length === 0) {
      listContainer.innerHTML = '<li class="list-item">No flashcards yet.</li>';
      return;
    }
    
    // Sort cards by next review date
    cardArray.sort((a, b) => a.nextReview - b.nextReview);
    
    let html = '';
    for (const card of cardArray) {
      const isDue = card.nextReview <= now;
      const dueLabel = isDue ? '<span class="flashcard-due">Due</span>' : '';
      
      html += `
        <li class="flashcard-item" data-id="${card.id}">
          <div class="flashcard-item-content">
            <div class="flashcard-item-front">${escapeHTML(card.front.substring(0, 60))}${card.front.length > 60 ? '...' : ''} ${dueLabel}</div>
            <div class="flashcard-item-back">${escapeHTML(card.back.substring(0, 60))}${card.back.length > 60 ? '...' : ''}</div>
          </div>
          <div class="flashcard-actions">
            <button class="btn-tertiary btn-sm flashcard-edit-btn" data-id="${card.id}">Edit</button>
          </div>
        </li>
      `;
    }
    
    listContainer.innerHTML = html;
    
    // Add event listeners to edit buttons
    listContainer.querySelectorAll('.flashcard-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        editFlashcard(id);
      });
    });
    
    // Add event listeners to list items for preview
    listContainer.querySelectorAll('.flashcard-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        previewFlashcard(id);
      });
    });
  } catch (error) {
    console.error('[HintHopper] Error rendering flashcards list:', error);
    listContainer.innerHTML = `
      <li class="list-item">
        <div class="alert alert-error">
          <div class="alert-content">
            <div class="alert-message">Error loading flashcards.</div>
          </div>
        </div>
      </li>
    `;
  }
}

/**
 * Setup event listeners for flashcard UI
 */
function setupEventListeners() {
  // Create flashcard button
  const createButton = document.getElementById('createFlashcardBtn');
  if (createButton) {
    createButton.addEventListener('click', () => {
      showFlashcardCreationForm();
    });
  }
  
  // Start review button
  const startReviewBtn = document.getElementById('startReviewBtn');
  if (startReviewBtn) {
    startReviewBtn.addEventListener('click', () => {
      startFlashcardReview();
    });
  }
  
  // Flip card button
  const flipCardBtn = document.getElementById('flipCardBtn');
  if (flipCardBtn) {
    flipCardBtn.addEventListener('click', () => {
      flipCard();
    });
  }
  
  // Rating buttons - using query selector to get all rating buttons
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Get quality from data attribute (0-5)
      const quality = parseInt(btn.dataset.quality, 10);
      rateCard(quality);
    });
  });
}

/**
 * Show the flashcard creation form
 * @param {Object} note - Optional note to create from
 */
export function showFlashcardCreationForm(note = null) {
  // Create modal for flashcard creation
  const modalHtml = `
    <div class="modal active" id="flashcardCreateModal">
      <div class="modal-backdrop"></div>
      <div class="modal-container">
        <div class="modal-header">
          <h3 class="modal-title">Create Flashcard</h3>
          <button class="modal-close" id="closeFlashcardModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="flashcard-form">
            <div class="form-group">
              <label class="form-label" for="cardFrontInput">Front (Question)</label>
              <textarea class="form-textarea" id="cardFrontInput" rows="3">${note?.fields?.problem || ''}</textarea>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="cardBackInput">Back (Answer)</label>
              <textarea class="form-textarea" id="cardBackInput" rows="3">${note?.fields?.insight || note?.body || ''}</textarea>
            </div>
            
            <div class="flashcard-preview">
              <div class="flashcard-preview-title">Preview</div>
              <div class="flashcard-preview-front" id="previewFront">${note?.fields?.problem || 'Question will appear here'}</div>
              <div class="flashcard-preview-back" id="previewBack" style="display: none;">${note?.fields?.insight || note?.body || 'Answer will appear here'}</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="cancelFlashcardBtn">Cancel</button>
          <button class="btn-primary" id="saveFlashcardBtn">Create Flashcard</button>
        </div>
      </div>
    </div>
  `;
  
  // Append to body
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer.firstElementChild);
  
  // Add event listeners
  const modal = document.getElementById('flashcardCreateModal');
  const closeBtn = document.getElementById('closeFlashcardModal');
  const cancelBtn = document.getElementById('cancelFlashcardBtn');
  const saveBtn = document.getElementById('saveFlashcardBtn');
  const backdrop = modal.querySelector('.modal-backdrop');
  const frontInput = document.getElementById('cardFrontInput');
  const backInput = document.getElementById('cardBackInput');
  const previewFront = document.getElementById('previewFront');
  const previewBack = document.getElementById('previewBack');
  
  // Live preview
  frontInput.addEventListener('input', () => {
    previewFront.textContent = frontInput.value || 'Question will appear here';
  });
  
  backInput.addEventListener('input', () => {
    previewBack.textContent = backInput.value || 'Answer will appear here';
  });
  
  // Preview flipper
  previewFront.addEventListener('click', () => {
    previewFront.style.display = 'none';
    previewBack.style.display = 'block';
  });
  
  previewBack.addEventListener('click', () => {
    previewBack.style.display = 'none';
    previewFront.style.display = 'block';
  });
  
  const closeModal = () => {
    modal.remove();
  };
  
  const saveFlashcard = async () => {
    try {
      const front = frontInput.value.trim();
      const back = backInput.value.trim();
      
      if (!front || !back) {
        showNotification('Please provide both front and back content', 'warning');
        return;
      }
      
      // Create flashcard
      if (note) {
        await flashcards.createFromNote(note);
      } else {
        // Create a minimal note-like object
        const fakeNote = {
          id: `auto-${Date.now()}`,
          fields: {
            problem: front,
            insight: back
          },
          body: '',
          tags: []
        };
        await flashcards.createFromNote(fakeNote);
      }
      
      // Close modal and update UI
      closeModal();
      await updateFlashcardStats();
      await renderFlashcardsList();
      showNotification('Flashcard created successfully!', 'success');
    } catch (error) {
      console.error('[HintHopper] Error creating flashcard:', error);
      showNotification('Failed to create flashcard', 'error');
    }
  };
  
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  saveBtn.addEventListener('click', saveFlashcard);
}

/**
 * Preview a specific flashcard
 * @param {string} id - Flashcard ID
 */
async function previewFlashcard(id) {
  try {
    const card = await flashcards.get(id);
    if (!card) {
      showNotification('Flashcard not found', 'error');
      return;
    }
    
    // Create modal for preview
    const modalHtml = `
      <div class="modal active" id="flashcardPreviewModal">
        <div class="modal-backdrop"></div>
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">Flashcard Preview</h3>
            <button class="modal-close" id="closePreviewModal">&times;</button>
          </div>
          <div class="modal-body">
            <div class="flashcard-container">
              <div class="flashcard">
                <div class="flashcard-front active" id="previewCardFront">
                  <div class="flashcard-content">${escapeHTML(card.front)}</div>
                </div>
                <div class="flashcard-back" id="previewCardBack">
                  <div class="flashcard-content">${escapeHTML(card.back)}</div>
                </div>
              </div>
              
              <div class="flashcard-actions">
                <button class="btn-secondary" id="previewFlipBtn">Flip Card</button>
              </div>
              
              <div class="flashcard-meta">
                <div>Next review: ${formatDate(new Date(card.nextReview))}</div>
                <div>Reviews: ${card.reviews} (${card.correct} correct, ${card.incorrect} incorrect)</div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" id="editCardBtn">Edit</button>
            <button class="btn-primary" id="closePreviewBtn">Close</button>
          </div>
        </div>
      </div>
    `;
    
    // Append to body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer.firstElementChild);
    
    // Add event listeners
    const modal = document.getElementById('flashcardPreviewModal');
    const closeBtn = document.getElementById('closePreviewModal');
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    const editBtn = document.getElementById('editCardBtn');
    const flipBtn = document.getElementById('previewFlipBtn');
    const backdrop = modal.querySelector('.modal-backdrop');
    const frontEl = document.getElementById('previewCardFront');
    const backEl = document.getElementById('previewCardBack');
    
    let isFlipped = false;
    
    const closeModal = () => {
      modal.remove();
    };
    
    const flipCard = () => {
      if (isFlipped) {
        frontEl.classList.add('active');
        frontEl.classList.remove('inactive');
        backEl.classList.add('inactive');
        backEl.classList.remove('active');
        flipBtn.textContent = 'Flip Card';
      } else {
        frontEl.classList.remove('active');
        frontEl.classList.add('inactive');
        backEl.classList.remove('inactive');
        backEl.classList.add('active');
        flipBtn.textContent = 'Flip Back';
      }
      isFlipped = !isFlipped;
    };
    
    closeBtn.addEventListener('click', closeModal);
    closePreviewBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    flipBtn.addEventListener('click', flipCard);
    
    editBtn.addEventListener('click', () => {
      closeModal();
      editFlashcard(id);
    });
  } catch (error) {
    console.error('[HintHopper] Error previewing flashcard:', error);
    showNotification('Error previewing flashcard', 'error');
  }
}

/**
 * Edit a specific flashcard
 * @param {string} id - Flashcard ID
 */
async function editFlashcard(id) {
  try {
    const card = await flashcards.get(id);
    if (!card) {
      showNotification('Flashcard not found', 'error');
      return;
    }
    
    // Create modal for editing
    const modalHtml = `
      <div class="modal active" id="flashcardEditModal">
        <div class="modal-backdrop"></div>
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">Edit Flashcard</h3>
            <button class="modal-close" id="closeEditModal">&times;</button>
          </div>
          <div class="modal-body">
            <div class="flashcard-form">
              <div class="form-group">
                <label class="form-label" for="editFrontInput">Front (Question)</label>
                <textarea class="form-textarea" id="editFrontInput" rows="3">${escapeHTML(card.front)}</textarea>
              </div>
              
              <div class="form-group">
                <label class="form-label" for="editBackInput">Back (Answer)</label>
                <textarea class="form-textarea" id="editBackInput" rows="3">${escapeHTML(card.back)}</textarea>
              </div>
            </div>
            <div class="flashcard-rating" style="display: none;">
              <div class="flashcard-rating-header">Rate your response:</div>
              <div class="flashcard-rating-buttons">
                <button class="btn-error btn-sm rating-btn" data-quality="0">Failed</button>
                <button class="btn-error btn-sm rating-btn" data-quality="1">Hard</button>
                <button class="btn-warning btn-sm rating-btn" data-quality="2">Difficult</button>
                <button class="btn-warning btn-sm rating-btn" data-quality="3">Medium</button>
                <button class="btn-success btn-sm rating-btn" data-quality="4">Easy</button>
                <button class="btn-success btn-sm rating-btn" data-quality="5">Perfect</button>
              </div>
              <div class="rating-tip">0-2: Repeat soon, 3-5: Increasing intervals</div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-error" id="deleteCardBtn">Delete</button>
            <button class="btn-secondary" id="cancelEditBtn">Cancel</button>
            <button class="btn-primary" id="saveEditBtn">Save Changes</button>
          </div>
        </div>
      </div>
    `;
    
    // Append to body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer.firstElementChild);
    
    // Add event listeners
    const modal = document.getElementById('flashcardEditModal');
    const closeBtn = document.getElementById('closeEditModal');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const saveBtn = document.getElementById('saveEditBtn');
    const deleteBtn = document.getElementById('deleteCardBtn');
    const backdrop = modal.querySelector('.modal-backdrop');
    const frontInput = document.getElementById('editFrontInput');
    const backInput = document.getElementById('editBackInput');
    
    const closeModal = () => {
      modal.remove();
    };
    
    const saveChanges = async () => {
      try {
        const front = frontInput.value.trim();
        const back = backInput.value.trim();
        
        if (!front || !back) {
          showNotification('Please provide both front and back content', 'warning');
          return;
        }
        
        // Update flashcard
        await flashcards.update(id, { front, back, updatedAt: Date.now() });
        
        // Close modal and update UI
        closeModal();
        await renderFlashcardsList();
        showNotification('Flashcard updated successfully!', 'success');
      } catch (error) {
        console.error('[HintHopper] Error updating flashcard:', error);
        showNotification('Failed to update flashcard', 'error');
      }
    };
    
    const deleteCard = async () => {
      if (confirm('Are you sure you want to delete this flashcard?')) {
        try {
          await flashcards.delete(id);
          closeModal();
          await updateFlashcardStats();
          await renderFlashcardsList();
          showNotification('Flashcard deleted', 'success');
        } catch (error) {
          console.error('[HintHopper] Error deleting flashcard:', error);
          showNotification('Failed to delete flashcard', 'error');
        }
      }
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    saveBtn.addEventListener('click', saveChanges);
    deleteBtn.addEventListener('click', deleteCard);
  } catch (error) {
    console.error('[HintHopper] Error editing flashcard:', error);
    showNotification('Error editing flashcard', 'error');
  }
}

/**
 * Start flashcard review session
 */
async function startFlashcardReview() {
  try {
    // Get due cards
    const dueCards = await flashcards.getDueCards(100);
    
    if (dueCards.length === 0) {
      showNotification('No cards due for review!', 'info');
      return;
    }
    
    // Start a new session
    reviewCards = dueCards;
    currentCardIndex = 0;
    isCardFlipped = false;
    
    // Start flashcard session in database
    currentSession = await flashcards.startSession(dueCards.map(c => c.id));
    
    // Switch to review mode
    const flashcardsContent = document.getElementById('flashcardsContent');
    const flashcardReview = document.getElementById('flashcardReview');
    
    if (flashcardsContent && flashcardReview) {
      flashcardsContent.style.display = 'none';
      flashcardReview.style.display = 'block';
      
      // Show first card
      showCurrentCard();
    }
  } catch (error) {
    console.error('[HintHopper] Error starting review:', error);
    showNotification('Error starting flashcard review', 'error');
  }
}

/**
 * Show the current card in review
 */
function showCurrentCard() {
  if (!reviewCards || currentCardIndex >= reviewCards.length) {
    endReviewSession();
    return;
  }
  
  const card = reviewCards[currentCardIndex];
  const frontEl = document.getElementById('cardFront');
  const backEl = document.getElementById('cardBack');
  const flipBtn = document.getElementById('flipCardBtn');
  const ratingDiv = document.querySelector('.flashcard-rating');
  
  if (frontEl && backEl && flipBtn && ratingDiv) {
    // Set card content
    frontEl.innerHTML = `<div class="flashcard-content">${escapeHTML(card.front)}</div>`;
    backEl.innerHTML = `<div class="flashcard-content">${escapeHTML(card.back)}</div>`;
    
    // Reset card flip state
    isCardFlipped = false;
    frontEl.classList.add('active');
    frontEl.classList.remove('inactive');
    backEl.classList.add('inactive');
    backEl.classList.remove('active');
    
    // Reset buttons
    flipBtn.textContent = 'Show Answer';
    flipBtn.style.display = 'inline-block';
    ratingDiv.style.display = 'none';
    
    // Update progress
    const progressBar = document.getElementById('reviewProgress');
    const progressText = document.getElementById('reviewProgressText');
    
    if (progressBar && progressText) {
      const progress = ((currentCardIndex + 1) / reviewCards.length) * 100;
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `${currentCardIndex + 1}/${reviewCards.length}`;
    }
  }
}

/**
 * Flip the current card
 */
function flipCard() {
  const frontEl = document.getElementById('cardFront');
  const backEl = document.getElementById('cardBack');
  const flipBtn = document.getElementById('flipCardBtn');
  const ratingDiv = document.querySelector('.flashcard-rating');
  
  if (frontEl && backEl && flipBtn && ratingDiv) {
    if (isCardFlipped) {
      // Flip back to front
      frontEl.classList.add('active');
      frontEl.classList.remove('inactive');
      backEl.classList.add('inactive');
      backEl.classList.remove('active');
      flipBtn.textContent = 'Show Answer';
      ratingDiv.style.display = 'none';
    } else {
      // Flip to back
      frontEl.classList.remove('active');
      frontEl.classList.add('inactive');
      backEl.classList.remove('inactive');
      backEl.classList.add('active');
      flipBtn.textContent = 'Hide Answer';
      ratingDiv.style.display = 'flex';
    }
    
    isCardFlipped = !isCardFlipped;
  }
}

/**
 * Rate the current card
 * @param {number} quality - Quality of response (0-5)
 */
async function rateCard(quality) {
  if (!reviewCards || currentCardIndex >= reviewCards.length || !currentSession) {
    return;
  }
  
  try {
    const card = reviewCards[currentCardIndex];
    
    // Record result in session with quality rating
    // Note: recordSessionResult needs to be updated to pass quality instead of boolean
    await flashcards.recordSessionResult(currentSession.id, card.id, quality >= 3, quality);
    
    // Record card review with SM-2 algorithm
    await flashcards.recordReview(card.id, quality);
    
    // Show next review date tooltip
    const nextReviewDate = new Date(card.nextReview);
    const formattedDate = nextReviewDate.toLocaleDateString();
    showNotification(
      `Card scheduled for ${formattedDate}. ${getReviewFeedback(quality)}`, 
      quality >= 3 ? 'success' : 'warning',
      quality >= 3 ? 3000 : 5000 // Show longer for incorrect answers
    );
    
    // Move to next card
    currentCardIndex++;
    
    if (currentCardIndex >= reviewCards.length) {
      // End session if no more cards
      endReviewSession();
    } else {
      // Show next card
      showCurrentCard();
    }
  } catch (error) {
    console.error('[HintHopper] Error rating card:', error);
    showNotification('Error saving card rating', 'error');
  }
}

/**
 * Get feedback text based on quality rating
 * @param {number} quality - Quality rating (0-5)
 * @return {string} Feedback text
 */
function getReviewFeedback(quality) {
  switch (quality) {
    case 0:
      return "You'll see this card again very soon.";
    case 1:
      return "We'll review this again soon.";
    case 2:
      return "Keep practicing, you're getting there.";
    case 3:
      return "Good job! You're making progress.";
    case 4:
      return "Great recall! You're building mastery.";
    case 5:
      return "Perfect! This card is well on its way to long-term memory.";
    default:
      return "";
  }
}

/**
 * End the review session
 */
async function endReviewSession() {
  try {
    // Update statistics
    await updateFlashcardStats();
    
    // Switch back to content view
    const flashcardsContent = document.getElementById('flashcardsContent');
    const flashcardReview = document.getElementById('flashcardReview');
    
    if (flashcardsContent && flashcardReview) {
      flashcardsContent.style.display = 'block';
      flashcardReview.style.display = 'none';
    }
    
    // Show completion message
    showNotification('Review session completed!', 'success');
    
    // Reset state
    currentSession = null;
    currentCardIndex = 0;
    reviewCards = [];
  } catch (error) {
    console.error('[HintHopper] Error ending review session:', error);
  }
}

/**
 * Format a date in a human-readable way
 * @param {Date} date - Date to format
 * @return {string} Formatted date
 */
function formatDate(date) {
  if (!date) return 'N/A';
  
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @return {string} Escaped HTML
 */
function escapeHTML(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, (match) => {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return escapeMap[match];
  });
}

/**
 * Show a notification
 * @param {string} message - Message to show
 * @param {string} type - Notification type (info, success, warning, error)
 */
function showNotification(message, type) {
  // Use the global showNotification function if available
  if (typeof window.showNotification === 'function') {
    window.showNotification(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

export default {
  initFlashcards,
  updateFlashcardStats,
  renderFlashcardsList,
  showFlashcardCreationForm
};
