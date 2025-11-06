/**
 * HintHopper Mastery View Component
 * Displays concept mastery information and recommended concepts
 */

import { conceptGraph } from '../../lib/concept-graph.js';

// Constants
const MAX_CONCEPTS = 3;

/**
 * Renders the mastery view component in the specified container
 * @param {HTMLElement} container - The container element
 */
export async function renderMasteryView(container) {
  if (!container) return;
  
  try {
    // Get next concepts to learn
    const nextConcepts = await conceptGraph.getNextConcepts(MAX_CONCEPTS);
    const allMastery = await conceptGraph.getAllMastery();
    
    // Check if we have any mastery data
    const hasMasteryData = Object.keys(allMastery).length > 0;
    
    let html = '';
    
    if (!hasMasteryData) {
      // Show welcome message if no mastery data yet
      html = `
        <div class="mastery-empty">
          <h3>Build Your Concept Mastery</h3>
          <p>Start tracking your progress through concepts by using Bunji and saving notes.</p>
          <p>Your mastery dashboard will appear here once you've interacted with a few concepts.</p>
        </div>
      `;
    } else {
      // Count mastered concepts (confidence > 80%)
      const masteredCount = Object.values(allMastery).filter(m => m.confidence >= 80).length;
      const inProgressCount = Object.values(allMastery).filter(m => m.confidence > 0 && m.confidence < 80).length;
      const totalConcepts = Object.keys(allMastery).length;
      
      // Main mastery header
      html = `
        <div class="mastery-header">
          <h3>Your Concept Mastery</h3>
          <div class="mastery-stats">
            <div class="mastery-stat">
              <div class="mastery-number">${masteredCount}</div>
              <div class="mastery-label">Mastered</div>
            </div>
            <div class="mastery-stat">
              <div class="mastery-number">${inProgressCount}</div>
              <div class="mastery-label">In Progress</div>
            </div>
            <div class="mastery-stat">
              <div class="mastery-number">${totalConcepts}</div>
              <div class="mastery-label">Total</div>
            </div>
          </div>
        </div>
        
        <div class="mastery-next">
          <h4>Next Concepts to Learn</h4>
          ${nextConcepts.length === 0 ? 
            '<p class="mastery-no-next">Nice work! You\'ve mastered all available concepts.</p>' :
            '<div class="mastery-cards">'
          }
      `;
      
      // Create cards for next concepts
      for (const concept of nextConcepts) {
        const conceptData = await conceptGraph.getConcept(concept.id);
        if (!conceptData) continue;
        
        html += `
          <div class="mastery-card" data-concept-id="${concept.id}">
            <div class="mastery-card-header">
              <h5 class="mastery-card-title">${conceptData.name}</h5>
              ${renderMasteryIndicator(concept.confidence)}
            </div>
            <p class="mastery-card-desc">${conceptData.description}</p>
            
            <!-- Progress Bar for concept mastery -->
            <div class="concept-progress">
              <div class="progress">
                <div class="progress-bar ${getMasteryColorClass(concept.confidence)}" 
                     style="width: ${concept.confidence}%"></div>
              </div>
              <div class="mastery-level-label">${getMasteryLevelLabel(concept.confidence)}</div>
            </div>
            
            <!-- Recommendation reason -->
            ${concept.recommendationReason ? 
              `<div class="recommendation-reason">
                <span class="recommendation-reason-icon">🔸</span>
                <span class="recommendation-reason-text">${concept.recommendationReason}</span>
              </div>` : ''
            }
            
            <div class="mastery-card-footer">
              <div class="mastery-prereqs">
                ${conceptData.prerequisites.length > 0 ? 
                  `<span class="mastery-prereq-label">Prerequisites: ${conceptData.prerequisites.length}</span>` :
                  '<span class="mastery-prereq-label">No prerequisites</span>'
                }
              </div>
              <button class="btn-tertiary btn-sm mastery-detail-btn">Details</button>
            </div>
          </div>
        `;
      }
      
      if (nextConcepts.length > 0) {
        html += '</div>'; // Close mastery-cards
      }
      
      html += '</div>'; // Close mastery-next
    }
    
    // Render the HTML
    container.innerHTML = html;
    
    // Add event listeners to detail buttons
    container.querySelectorAll('.mastery-detail-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const card = e.target.closest('.mastery-card');
        if (!card) return;
        
        const conceptId = card.dataset.conceptId;
        if (!conceptId) return;
        
        showConceptDetail(conceptId);
      });
    });
    
  } catch (error) {
    console.error('[HintHopper] Error rendering mastery view:', error);
    container.innerHTML = `
      <div class="alert alert-error">
        <div class="alert-content">
          <div class="alert-message">Error loading mastery data. Please try again later.</div>
        </div>
      </div>
    `;
  }
}

/**
 * Renders a mastery indicator badge based on confidence level
 * @param {number} confidence - Confidence level (0-100)
 * @return {string} HTML string for the indicator
 */
function renderMasteryIndicator(confidence) {
  if (confidence <= 0) {
    return '<div class="mastery-badge mastery-badge-new">New</div>';
  }
  
  // Create mastery badge with appropriate status
  if (confidence >= 80) {
    return `
      <div class="mastery-badge mastery-badge-mastered" title="Mastered">
        <span class="mastery-badge-icon">✓</span>
        <span class="mastery-badge-text">${confidence}%</span>
      </div>
    `;
  } else if (confidence >= 50) {
    return `
      <div class="mastery-badge mastery-badge-familiar" title="Familiar">
        <span class="mastery-badge-icon">↗</span>
        <span class="mastery-badge-text">${confidence}%</span>
      </div>
    `;
  } else {
    return `
      <div class="mastery-badge mastery-badge-learning" title="Learning">
        <span class="mastery-badge-text">${confidence}%</span>
      </div>
    `;
  }
}

/**
 * Get the CSS class for a mastery progress bar based on confidence
 * @param {number} confidence - Confidence level (0-100)
 * @return {string} CSS class for the progress bar
 */
function getMasteryColorClass(confidence) {
  if (confidence >= 80) return 'progress-success';
  if (confidence >= 50) return 'progress-primary';
  if (confidence > 0) return 'progress-warning';
  return ''; // Default color
}

/**
 * Get a descriptive label for a mastery level
 * @param {number} confidence - Confidence level (0-100)
 * @return {string} Descriptive label
 */
function getMasteryLevelLabel(confidence) {
  if (confidence >= 80) return 'Mastered';
  if (confidence >= 50) return 'Familiar';
  if (confidence > 20) return 'Learning';
  if (confidence > 0) return 'Beginner';
  return 'New';
}

/**
 * Shows detailed information about a concept in a modal
 * @param {string} conceptId - The ID of the concept to show
 */
async function showConceptDetail(conceptId) {
  try {
    // Get the concept data
    const concept = await conceptGraph.getConcept(conceptId);
    if (!concept) {
      console.error(`[HintHopper] Concept not found: ${conceptId}`);
      return;
    }
    
    // Get related concepts
    const related = await conceptGraph.getRelatedConcepts(conceptId);
    
    // Get mastery data
    const mastery = await conceptGraph.getMastery(conceptId);
    
    // Create modal HTML
    const modalHtml = `
      <div class="modal active" id="conceptDetailModal">
        <div class="modal-backdrop"></div>
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">${concept.name}</h3>
            <button class="modal-close" id="closeConceptModal">&times;</button>
          </div>
          <div class="modal-body">
            <div class="concept-detail">
              <p class="concept-description">${concept.description}</p>
              
              <h4>Examples</h4>
              <div class="concept-examples">
                ${concept.examples.map(ex => `<code>${ex}</code>`).join('')}
              </div>
              
              ${related.prerequisites.length > 0 ? `
                <h4>Prerequisites</h4>
                <ul class="concept-prereqs">
                  ${related.prerequisites.map(pre => `<li>${pre.name}</li>`).join('')}
                </ul>
              ` : ''}
              
              ${related.dependents.length > 0 ? `
                <h4>Unlocks</h4>
                <ul class="concept-dependents">
                  ${related.dependents.map(dep => `<li>${dep.name}</li>`).join('')}
                </ul>
              ` : ''}
              
              <h4>Your Mastery</h4>
              <div class="concept-mastery">
                <div class="concept-mastery-progress">
                  <div class="mastery-header">
                    <span class="mastery-level">${getMasteryLevelLabel(confidencePct)}</span>
                    ${renderMasteryIndicator(confidencePct)}
                  </div>
                  <div class="progress">
                    <div class="progress-bar ${getMasteryColorClass(confidencePct)}" 
                         style="width: ${confidencePct}%"></div>
                  </div>
                  <div class="concept-mastery-label">${confidencePct}% Confidence</div>
                </div>
                
                <div class="concept-mastery-stats">
                  <div class="mastery-stat">
                    <div class="mastery-number">${viewCount}</div>
                    <div class="mastery-label">Views</div>
                  </div>
                  <div class="mastery-stat">
                    <div class="mastery-number">${passCount}</div>
                    <div class="mastery-label">Passes</div>
                  </div>
                  <div class="mastery-stat">
                    <div class="mastery-number">${streak}</div>
                    <div class="mastery-label">Streak</div>
                  </div>
                </div>
                
                <div class="concept-mastery-timeline">
                  <h5>Mastery Timeline</h5>
                  <div class="timeline">
                    <div class="timeline-item ${mastery.viewed > 0 ? 'complete' : ''}">
                      <div class="timeline-icon">👁️</div>
                      <div class="timeline-content">
                        <div class="timeline-title">Viewed</div>
                        <div class="timeline-date">${mastery.lastViewedAt ? new Date(mastery.lastViewedAt).toLocaleDateString() : 'Never'}</div>
                      </div>
                    </div>
                    <div class="timeline-item ${mastery.passed > 0 ? 'complete' : ''}">
                      <div class="timeline-icon">✓</div>
                      <div class="timeline-content">
                        <div class="timeline-title">First Pass</div>
                        <div class="timeline-date">${mastery.lastPassedAt ? new Date(mastery.lastPassedAt).toLocaleDateString() : 'Not yet'}</div>
                      </div>
                    </div>
                    <div class="timeline-item ${mastery.confidence >= 80 ? 'complete' : ''}">
                      <div class="timeline-icon">🏆</div>
                      <div class="timeline-content">
                        <div class="timeline-title">Mastered</div>
                        <div class="timeline-date">${mastery.confidence >= 80 ? 'Achieved' : 'In progress'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" id="closeConceptDetailBtn">Close</button>
          </div>
        </div>
      </div>
    `;
    
    // Append to body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer.firstElementChild);
    
    // Add event listeners
    const modal = document.getElementById('conceptDetailModal');
    const closeBtn = document.getElementById('closeConceptModal');
    const closeDetailBtn = document.getElementById('closeConceptDetailBtn');
    const backdrop = modal.querySelector('.modal-backdrop');
    
    const closeModal = () => {
      modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    closeDetailBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
  } catch (error) {
    console.error('[HintHopper] Error showing concept detail:', error);
  }
}

export default { renderMasteryView };
