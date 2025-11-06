/**
 * Analytics View for HintHopper
 * Visualizes outcome data and learning progress
 */

// Import Chart.js for data visualization
let Chart;
if (typeof window !== 'undefined') {
  import('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/+esm').then(module => {
    Chart = module.default;
    console.log('[HintHopper] Chart.js loaded');
  }).catch(err => {
    console.error('[HintHopper] Failed to load Chart.js:', err);
  });
}

/**
 * Renders the analytics dashboard
 * @param {HTMLElement} container - The container to render the dashboard into
 */
export async function renderAnalyticsView(container) {
  if (!container) return;
  
  try {
    // Import required modules
    const outcomeTracker = (await import('../../lib/outcome-tracker.js')).default;
    const conceptGraph = (await import('../../lib/concept-graph.js')).default;
    
    // Check if analytics are enabled
    const isEnabled = await outcomeTracker.isEnabled();
    if (!isEnabled) {
      renderDisabledState(container);
      return;
    }
    
    // Get statistics for visualization
    const overallStats = await outcomeTracker.getOverallStats();
    const conceptStats = await outcomeTracker.getAllConceptStats();
    const masteryData = await conceptGraph.getAllMastery();
    
    // Render the dashboard
    container.innerHTML = `
      <div class="analytics-dashboard">
        <div class="analytics-section">
          <h3 class="analytics-title">Hint Effectiveness</h3>
          <div class="analytics-cards">
            <div class="analytics-card">
              <div class="analytics-card-value">${formatPercent(overallStats.passRate)}</div>
              <div class="analytics-card-label">Overall Pass Rate</div>
            </div>
            <div class="analytics-card">
              <div class="analytics-card-value">${formatPercent(overallStats.passWithin10Rate)}</div>
              <div class="analytics-card-label">Pass Within 10 Minutes</div>
            </div>
            <div class="analytics-card">
              <div class="analytics-card-value">${formatMinutes(overallStats.avgTimeToPass)}</div>
              <div class="analytics-card-label">Avg. Time to Pass</div>
            </div>
            <div class="analytics-card">
              <div class="analytics-card-value">${overallStats.totalHints}</div>
              <div class="analytics-card-label">Hints Received</div>
            </div>
          </div>
          
          <div class="chart-container">
            <canvas id="passRateChart" height="250"></canvas>
          </div>
        </div>
        
        <div class="analytics-section">
          <h3 class="analytics-title">Concept Mastery Overview</h3>
          <div class="chart-container">
            <canvas id="masteryChart" height="300"></canvas>
          </div>
        </div>
        
        <div class="analytics-section">
          <h3 class="analytics-title">Top Concepts</h3>
          <div id="topConcepts" class="top-concepts"></div>
        </div>
      </div>
    `;
    
    // Render charts after DOM is ready
    setTimeout(() => {
      renderPassRateChart(conceptStats);
      renderMasteryChart(masteryData);
      renderTopConcepts(conceptStats, masteryData);
    }, 100);
    
  } catch (error) {
    console.error('[HintHopper] Error rendering analytics view:', error);
    container.innerHTML = `
      <div class="alert alert-error">
        <div class="alert-content">
          <div class="alert-message">Error loading analytics data. Please try again later.</div>
        </div>
      </div>
    `;
  }
}

/**
 * Renders the disabled state when analytics are not enabled
 * @param {HTMLElement} container - The container to render into
 */
function renderDisabledState(container) {
  container.innerHTML = `
    <div class="analytics-disabled">
      <div class="analytics-disabled-icon">📊</div>
      <h3>Analytics Not Enabled</h3>
      <p>Enable "Improve Bunji" in settings to collect anonymous usage data and view your hint effectiveness.</p>
      <button id="enableAnalyticsBtn" class="btn-primary">Enable Analytics</button>
    </div>
  `;
  
  // Add event listener to enable analytics
  document.getElementById('enableAnalyticsBtn')?.addEventListener('click', async () => {
    try {
      const outcomeTracker = (await import('../../lib/outcome-tracker.js')).default;
      await outcomeTracker.setEnabled(true);
      
      // Update settings UI
      const improveCheckbox = document.getElementById('improveToggle');
      if (improveCheckbox) improveCheckbox.checked = true;
      
      // Re-render the view
      renderAnalyticsView(container);
      
      // Show notification
      if (typeof showNotification === 'function') {
        showNotification('Analytics enabled successfully!', 'success');
      }
    } catch (error) {
      console.error('[HintHopper] Error enabling analytics:', error);
      if (typeof showNotification === 'function') {
        showNotification('Error enabling analytics', 'error');
      }
    }
  });
}

/**
 * Renders the pass rate chart
 * @param {Object} conceptStats - Stats by concept
 */
function renderPassRateChart(conceptStats) {
  if (!Chart || !document.getElementById('passRateChart')) return;
  
  const concepts = Object.keys(conceptStats).slice(0, 10); // Top 10 concepts
  const passRates = concepts.map(c => (conceptStats[c].passRate || 0) * 100);
  const passWithin10Rates = concepts.map(c => (conceptStats[c].passWithin10Rate || 0) * 100);
  
  const conceptNames = concepts.map(c => formatConceptName(c));
  
  new Chart(document.getElementById('passRateChart'), {
    type: 'bar',
    data: {
      labels: conceptNames,
      datasets: [
        {
          label: 'Pass Rate (%)',
          data: passRates,
          backgroundColor: 'rgba(75, 192, 192, 0.7)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        },
        {
          label: 'Pass Within 10min (%)',
          data: passWithin10Rates,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Hint Effectiveness by Concept'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Pass Rate (%)'
          }
        }
      }
    }
  });
}

/**
 * Renders the mastery chart
 * @param {Object} masteryData - Mastery data by concept
 */
function renderMasteryChart(masteryData) {
  if (!Chart || !document.getElementById('masteryChart')) return;
  
  // Count concepts at each mastery level
  const masteryCounts = {
    mastered: 0,
    familiar: 0,
    learning: 0,
    viewed: 0
  };
  
  Object.values(masteryData).forEach(mastery => {
    if (mastery.confidence >= 80) masteryCounts.mastered++;
    else if (mastery.confidence >= 50) masteryCounts.familiar++;
    else if (mastery.confidence > 0) masteryCounts.learning++;
    else if (mastery.viewed > 0) masteryCounts.viewed++;
  });
  
  new Chart(document.getElementById('masteryChart'), {
    type: 'pie',
    data: {
      labels: ['Mastered', 'Familiar', 'Learning', 'Viewed'],
      datasets: [{
        data: [
          masteryCounts.mastered,
          masteryCounts.familiar,
          masteryCounts.learning,
          masteryCounts.viewed
        ],
        backgroundColor: [
          'rgba(75, 192, 92, 0.7)',  // Green for mastered
          'rgba(54, 162, 235, 0.7)', // Blue for familiar
          'rgba(255, 205, 86, 0.7)', // Yellow for learning
          'rgba(201, 203, 207, 0.7)' // Gray for viewed
        ],
        borderColor: [
          'rgb(75, 192, 92)',
          'rgb(54, 162, 235)',
          'rgb(255, 205, 86)',
          'rgb(201, 203, 207)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right',
        },
        title: {
          display: true,
          text: 'Concept Mastery Distribution'
        }
      }
    }
  });
}

/**
 * Renders the top concepts section
 * @param {Object} conceptStats - Stats by concept
 * @param {Object} masteryData - Mastery data by concept
 */
async function renderTopConcepts(conceptStats, masteryData) {
  const topConceptsContainer = document.getElementById('topConcepts');
  if (!topConceptsContainer) return;
  
  // Import concept graph for concept details
  const conceptGraph = (await import('../../lib/concept-graph.js')).default;
  
  // Get top concepts by pass rate
  const topConcepts = Object.entries(conceptStats)
    .filter(([_, stats]) => stats.totalHints > 2) // Only concepts with enough data
    .sort(([_, statsA], [__, statsB]) => (statsB.passWithin10Rate || 0) - (statsA.passWithin10Rate || 0))
    .slice(0, 5); // Top 5
  
  let html = '';
  for (const [conceptId, stats] of topConcepts) {
    const conceptData = await conceptGraph.getConcept(conceptId);
    const mastery = masteryData[conceptId] || { confidence: 0 };
    
    html += `
      <div class="top-concept-item">
        <div class="top-concept-header">
          <div class="top-concept-name">${conceptData?.name || formatConceptName(conceptId)}</div>
          <div class="top-concept-badge ${getMasteryClass(mastery.confidence)}">
            ${getMasteryLevelLabel(mastery.confidence)}
          </div>
        </div>
        <div class="top-concept-stats">
          <div class="top-concept-stat">
            <div class="stat-value">${formatPercent(stats.passRate)}</div>
            <div class="stat-label">Pass Rate</div>
          </div>
          <div class="top-concept-stat">
            <div class="stat-value">${formatPercent(stats.passWithin10Rate)}</div>
            <div class="stat-label">Quick Pass</div>
          </div>
          <div class="top-concept-stat">
            <div class="stat-value">${formatMinutes(stats.avgTimeToPass)}</div>
            <div class="stat-label">Avg Time</div>
          </div>
        </div>
        <div class="top-concept-progress">
          <div class="progress">
            <div class="progress-bar ${getMasteryColorClass(mastery.confidence)}" 
                style="width: ${mastery.confidence}%"></div>
          </div>
        </div>
      </div>
    `;
  }
  
  topConceptsContainer.innerHTML = html || '<div class="empty-state">No concept data yet</div>';
}

/**
 * Format a number as a percentage
 * @param {number} value - Value to format (0-1)
 * @return {string} Formatted percentage
 */
function formatPercent(value) {
  if (value === null || value === undefined) return 'N/A';
  return `${Math.round((value * 100) * 10) / 10}%`;
}

/**
 * Format minutes nicely
 * @param {number} minutes - Minutes to format
 * @return {string} Formatted time
 */
function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined) return 'N/A';
  if (minutes < 1) return '< 1 min';
  return `${Math.round(minutes * 10) / 10} min`;
}

/**
 * Format a concept ID into a readable name
 * @param {string} conceptId - The concept ID
 * @return {string} Formatted name
 */
function formatConceptName(conceptId) {
  if (!conceptId) return 'Unknown';
  return conceptId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get the CSS class for a mastery level badge
 * @param {number} confidence - Confidence level (0-100)
 * @return {string} CSS class
 */
function getMasteryClass(confidence) {
  if (confidence >= 80) return 'mastery-badge-mastered';
  if (confidence >= 50) return 'mastery-badge-familiar';
  if (confidence > 0) return 'mastery-badge-learning';
  return 'mastery-badge-new';
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
 * Get the CSS class for a mastery progress bar
 * @param {number} confidence - Confidence level (0-100)
 * @return {string} CSS class
 */
function getMasteryColorClass(confidence) {
  if (confidence >= 80) return 'progress-success';
  if (confidence >= 50) return 'progress-primary';
  if (confidence > 0) return 'progress-warning';
  return '';
}

export default { renderAnalyticsView };
