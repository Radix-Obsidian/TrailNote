// HintHopper Concept Graph
// Core concept taxonomy and relationships

import { store } from './storage.js';
import { conceptIdFrom } from './utils.js';

// Constants
const CONCEPTS_STORE_KEY = 'concept_graph';
const MASTERY_STORE_KEY = 'concept_mastery';

// Core concept taxonomy - initial set of freeCodeCamp HTML/CSS concepts
const CORE_CONCEPTS = {
  // HTML Structure concepts
  'html-structure': {
    name: 'HTML Document Structure',
    description: 'Basic structure of an HTML document including doctype, head, and body elements',
    tags: ['html', 'structure'],
    examples: ['<!DOCTYPE html>', '<html>', '<head>', '<body>'],
    prerequisites: []
  },
  
  // Text formatting
  'headings': {
    name: 'HTML Headings',
    description: 'Heading elements (h1-h6) for content hierarchy',
    tags: ['html', 'text', 'headings'],
    examples: ['<h1>Main Heading</h1>', '<h2>Subheading</h2>'],
    prerequisites: ['html-structure']
  },
  'paragraphs': {
    name: 'Paragraphs',
    description: 'Paragraph elements for text content',
    tags: ['html', 'text'],
    examples: ['<p>This is a paragraph.</p>'],
    prerequisites: ['html-structure']
  },
  'text-formatting': {
    name: 'Text Formatting',
    description: 'Elements for formatting text (strong, em, mark, etc.)',
    tags: ['html', 'text', 'formatting'],
    examples: ['<strong>bold</strong>', '<em>italic</em>'],
    prerequisites: ['paragraphs']
  },
  
  // Links and images
  'links': {
    name: 'HTML Links',
    description: 'Creating hyperlinks with anchor tags',
    tags: ['html', 'links'],
    examples: ['<a href="https://example.com">Link</a>'],
    prerequisites: ['html-structure']
  },
  'link-inside-p': {
    name: 'Link Inside Paragraph',
    description: 'Proper nesting of anchor tags within paragraph elements',
    tags: ['html', 'links', 'paragraphs', 'nesting'],
    examples: ['<p>This is a <a href="https://example.com">link</a> in a paragraph.</p>'],
    prerequisites: ['links', 'paragraphs']
  },
  'images': {
    name: 'Images',
    description: 'Adding images to web pages',
    tags: ['html', 'images'],
    examples: ['<img src="image.jpg" alt="Description">'],
    prerequisites: ['html-structure']
  },
  'image-alt-text': {
    name: 'Image Alt Text',
    description: 'Providing alternative text for images for accessibility',
    tags: ['html', 'images', 'accessibility'],
    examples: ['<img src="image.jpg" alt="Descriptive text for accessibility">'],
    prerequisites: ['images']
  },
  
  // Lists
  'unordered-lists': {
    name: 'Unordered Lists',
    description: 'Creating bullet point lists',
    tags: ['html', 'lists'],
    examples: ['<ul><li>Item 1</li><li>Item 2</li></ul>'],
    prerequisites: ['html-structure']
  },
  'ordered-lists': {
    name: 'Ordered Lists',
    description: 'Creating numbered lists',
    tags: ['html', 'lists'],
    examples: ['<ol><li>First item</li><li>Second item</li></ol>'],
    prerequisites: ['html-structure']
  },
  'nested-lists': {
    name: 'Nested Lists',
    description: 'Creating lists within lists',
    tags: ['html', 'lists', 'nesting'],
    examples: ['<ul><li>Item 1<ul><li>Subitem</li></ul></li></ul>'],
    prerequisites: ['unordered-lists', 'ordered-lists']
  },
  
  // Forms
  'form-basics': {
    name: 'Form Basics',
    description: 'Creating HTML forms',
    tags: ['html', 'forms'],
    examples: ['<form action="/submit" method="post"></form>'],
    prerequisites: ['html-structure']
  },
  'form-inputs': {
    name: 'Form Input Elements',
    description: 'Different types of form input elements',
    tags: ['html', 'forms', 'inputs'],
    examples: ['<input type="text" name="username">', '<input type="password">'],
    prerequisites: ['form-basics']
  },
  'form-labels': {
    name: 'Form Labels',
    description: 'Associating labels with form inputs for accessibility',
    tags: ['html', 'forms', 'accessibility'],
    examples: ['<label for="username">Username:</label><input id="username">'],
    prerequisites: ['form-inputs']
  },
  
  // CSS basics
  'css-selectors': {
    name: 'CSS Selectors',
    description: 'Selecting elements to apply styles',
    tags: ['css', 'selectors'],
    examples: ['element', '.class', '#id', 'element.class'],
    prerequisites: ['html-structure']
  },
  'css-colors': {
    name: 'CSS Colors',
    description: 'Setting colors in CSS using different formats',
    tags: ['css', 'colors'],
    examples: ['color: red;', 'color: #ff0000;', 'color: rgb(255, 0, 0);'],
    prerequisites: ['css-selectors']
  },
  'css-background': {
    name: 'CSS Backgrounds',
    description: 'Setting background colors and images',
    tags: ['css', 'backgrounds'],
    examples: ['background-color: #f0f0f0;', 'background-image: url("bg.jpg");'],
    prerequisites: ['css-colors']
  },
  'css-box-model': {
    name: 'CSS Box Model',
    description: 'Understanding content, padding, border, and margin',
    tags: ['css', 'layout', 'box-model'],
    examples: ['padding: 10px;', 'margin: 20px;', 'border: 1px solid black;'],
    prerequisites: ['css-selectors']
  },
  
  // Layout
  'css-display': {
    name: 'CSS Display Property',
    description: 'Controlling how elements are displayed (block, inline, etc.)',
    tags: ['css', 'layout'],
    examples: ['display: block;', 'display: inline;', 'display: none;'],
    prerequisites: ['css-box-model']
  },
  'css-position': {
    name: 'CSS Positioning',
    description: 'Positioning elements on the page',
    tags: ['css', 'layout', 'positioning'],
    examples: ['position: relative;', 'position: absolute;', 'top: 10px;'],
    prerequisites: ['css-display']
  },
  'css-flexbox': {
    name: 'CSS Flexbox',
    description: 'Flexible box layout for responsive design',
    tags: ['css', 'layout', 'flexbox'],
    examples: ['display: flex;', 'flex-direction: row;', 'justify-content: center;'],
    prerequisites: ['css-display']
  },
  
  // Responsive design
  'css-media-queries': {
    name: 'CSS Media Queries',
    description: 'Creating responsive designs for different screen sizes',
    tags: ['css', 'responsive'],
    examples: ['@media (max-width: 600px) { /* styles */ }'],
    prerequisites: ['css-selectors']
  },
  'responsive-images': {
    name: 'Responsive Images',
    description: 'Making images adapt to different screen sizes',
    tags: ['html', 'css', 'images', 'responsive'],
    examples: ['img { max-width: 100%; height: auto; }'],
    prerequisites: ['images', 'css-media-queries']
  }
};

// Main concept graph interface
export const conceptGraph = {
  // Get the full concept graph with mastery data
  async getGraph() {
    const graph = await store.get(CONCEPTS_STORE_KEY, CORE_CONCEPTS);
    return graph;
  },
  
  // Get a specific concept by ID
  async getConcept(conceptId) {
    const graph = await this.getGraph();
    return graph[conceptId] || null;
  },
  
  // Get mastery data for all concepts
  async getAllMastery() {
    return await store.get(MASTERY_STORE_KEY, {});
  },
  
  // Get mastery data for a specific concept
  async getMastery(conceptId) {
    const masteryData = await this.getAllMastery();
    return masteryData[conceptId] || {
      viewed: 0,
      passed: 0,
      confidence: 0,
      lastViewedAt: null,
      lastPassedAt: null,
      streak: 0
    };
  },
  
  // Update mastery when concept is viewed
  async trackConceptViewed(conceptId) {
    const masteryData = await this.getAllMastery();
    const now = Date.now();
    
    if (!masteryData[conceptId]) {
      masteryData[conceptId] = {
        viewed: 0,
        passed: 0,
        confidence: 0,
        lastViewedAt: null,
        lastPassedAt: null,
        streak: 0
      };
    }
    
    masteryData[conceptId].viewed += 1;
    masteryData[conceptId].lastViewedAt = now;
    
    await store.set(MASTERY_STORE_KEY, masteryData);
    return masteryData[conceptId];
  },
  
  // Update mastery when concept is passed
  async trackConceptPassed(conceptId) {
    const masteryData = await this.getAllMastery();
    const now = Date.now();
    
    if (!masteryData[conceptId]) {
      masteryData[conceptId] = {
        viewed: 1,
        passed: 0,
        confidence: 0,
        lastViewedAt: now,
        lastPassedAt: null,
        streak: 0
      };
    }
    
    masteryData[conceptId].passed += 1;
    masteryData[conceptId].lastPassedAt = now;
    masteryData[conceptId].lastViewedAt = now;
    
    // Update streak
    const daysSinceLastPass = masteryData[conceptId].lastPassedAt ? 
      (now - masteryData[conceptId].lastPassedAt) / (1000 * 60 * 60 * 24) : 
      Infinity;
    
    if (daysSinceLastPass < 7) { // If passed within last week
      masteryData[conceptId].streak += 1;
    } else {
      masteryData[conceptId].streak = 1;
    }
    
    // Calculate confidence (0-100)
    const passRatio = masteryData[conceptId].passed / masteryData[conceptId].viewed;
    const streakFactor = Math.min(masteryData[conceptId].streak / 5, 1); // Max effect at 5 streak
    masteryData[conceptId].confidence = Math.min(Math.round(passRatio * 70 + streakFactor * 30), 100);
    
    await store.set(MASTERY_STORE_KEY, masteryData);
    return masteryData[conceptId];
  },
  
  // Find concept ID from text
  async findConceptFromText(text) {
    const textId = conceptIdFrom(text);
    const graph = await this.getGraph();
    
    // Direct match
    if (graph[textId]) {
      return textId;
    }
    
    // Try to match by tags
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [id, concept] of Object.entries(graph)) {
      let score = 0;
      
      // Check if any tags match words in the text
      for (const tag of concept.tags) {
        if (words.includes(tag)) {
          score += 3;
        }
      }
      
      // Check for example matches
      for (const example of concept.examples) {
        if (text.includes(example)) {
          score += 5;
        }
      }
      
      // Check name match
      const nameWords = concept.name.toLowerCase().split(/\W+/);
      for (const word of nameWords) {
        if (words.includes(word)) {
          score += 2;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = id;
      }
    }
    
    return bestScore > 3 ? bestMatch : null;
  },
  
  /**
   * Get recommendations for next concepts to learn
   * @param {number} count - Number of concepts to recommend
   * @param {boolean} useAdaptiveLearning - Whether to use adaptive learning for recommendations
   * @return {Array} Array of concept objects with scores and reasons
   */
  async getNextConcepts(count = 3, useAdaptiveLearning = true) {
    // Get initial candidates from building function
    const candidates = await this._buildLearningPathCandidates();
    
    // If adaptive learning module is available and enabled, use it for recommendations
    if (useAdaptiveLearning) {
      try {
        // Import adaptiveLearning module
        const adaptiveLearning = (await import('./adaptive-learning.js')).default;
        
        // Generate adaptive learning path
        const learningPath = await adaptiveLearning.generateLearningPath(
          candidates.map(c => c.id)
        );
        
        // Map learning path concepts to candidates
        const adaptiveCandidates = [];
        for (const conceptId of learningPath.concepts) {
          const candidate = candidates.find(c => c.id === conceptId);
          if (candidate) {
            // Update reason with adaptive learning insight if available
            if (learningPath.metadata && learningPath.metadata.focusAreas) {
              const focusArea = learningPath.metadata.focusAreas.find(
                area => area.category === (this._concepts[conceptId]?.category || 'general')
              );
              
              if (focusArea) {
                candidate.adaptiveReason = focusArea.description;
              }
            }
            adaptiveCandidates.push(candidate);
          }
        }
        
        if (adaptiveCandidates.length > 0) {
          // Return adaptive candidates if available
          return adaptiveCandidates.slice(0, count);
        }
      } catch (error) {
        console.warn('[HintHopper] Error using adaptive learning for recommendations:', error);
        // Fall back to regular recommendations if adaptive learning fails
      }
    }
    
    // Calculate advanced recommendation scores (standard approach)
    for (let candidate of candidates) {
      candidate.score = await this._calculateAdvancedRecommendationScore(candidate);
      candidate.reason = await this._getRecommendationReason(candidate);
    }
    
    // Sort by score (highest first) and take requested count
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  },
        ...masteryInfo,
        recommendationReason: this._getRecommendationReason(concept, mastery)
      };
    });
  },
  
  /**
   * Build candidates for learning path based on various factors
   * @private
   * @param {Object} mastery - Mastery data for concepts
   * @return {Array} Candidate concepts for recommendations
   */
  async _buildLearningPathCandidates(mastery) {
    const allConcepts = Object.values(CORE_CONCEPTS);
    const masteredConceptIds = new Set(
      Object.entries(mastery)
        .filter(([_, data]) => data.confidence >= 80)
        .map(([id, _]) => id)
    );
    const inProgressConceptIds = new Set(
      Object.entries(mastery)
        .filter(([_, data]) => data.confidence > 0 && data.confidence < 80)
        .map(([id, _]) => id)
    );
    
    // Candidates in different categories
    const inProgress = [];
    const readyToLearn = [];
    const prerequisites = [];
    const newConcepts = [];
    
    // Categorize all concepts
    for (const concept of allConcepts) {
      // Skip already mastered concepts
      if (masteredConceptIds.has(concept.id)) {
        continue;
      }
      
      // Concepts already in progress get highest priority
      if (inProgressConceptIds.has(concept.id)) {
        inProgress.push(concept);
        continue;
      }
      
      // Check if all prerequisites are met
      const prereqsMet = !concept.prerequisites || 
        concept.prerequisites.length === 0 || 
        concept.prerequisites.every(prereq => masteredConceptIds.has(prereq));
      
      if (prereqsMet) {
        // Ready to learn - all prerequisites mastered
        readyToLearn.push(concept);
      } else {
        // Some prerequisites not met
        const somePrereqsMet = concept.prerequisites.some(prereq => masteredConceptIds.has(prereq));
        if (somePrereqsMet) {
          // At least one prerequisite met
          prerequisites.push(concept);
        } else {
          // No prerequisites met yet
          newConcepts.push(concept);
        }
      }
      
    }
    
    // Combine in priority order: in progress, ready to learn, some prerequisites met, new
    return [...inProgress, ...readyToLearn, ...prerequisites, ...newConcepts];
  },
  
  /**
   * Calculate an advanced recommendation score for a concept
   * @private
   * @param {Object} concept - The concept to score
   * @param {Object} mastery - Mastery data for all concepts
   * @return {number} A recommendation score (higher is better)
   */
  _calculateAdvancedRecommendationScore(concept, mastery) {
    let score = 0;
    const conceptMastery = mastery[concept.id] || { viewed: 0, passed: 0, confidence: 0 };
    
    // Factor 1: Current progress (0-50 points)
    // Concepts already started but not mastered get priority
    if (conceptMastery.confidence > 0) {
      // Higher priority to concepts closer to mastery
      score += (conceptMastery.confidence / 100) * 50;
    }
    
    // Factor 2: Prerequisite completion (0-30 points)
    const prerequisites = concept.prerequisites || [];
    if (prerequisites.length > 0) {
      let prereqsMasteredCount = 0;
      for (const prereqId of prerequisites) {
        if (mastery[prereqId] && mastery[prereqId].confidence >= 80) {
          prereqsMasteredCount++;
        }
      }
      
      const prereqCompletion = prereqsMasteredCount / prerequisites.length;
      score += prereqCompletion * 30;
    } else {
      // If no prerequisites, give full points
      score += 30;
    }
    
    // Factor 3: Concept importance/value (0-20 points)
    // More dependent concepts (those that unlock others) have higher value
    const dependents = Object.values(CORE_CONCEPTS).filter(c => 
      c.prerequisites && c.prerequisites.includes(concept.id)
    );
    
    const importanceScore = Math.min(20, dependents.length * 5);
    score += importanceScore;
    
    return score;
  },
  
  /**
   * Get a human-readable reason for recommending a concept
   * @private
   * @param {Object} concept - The concept being recommended
   * @param {Object} mastery - Mastery data for all concepts
   * @return {string} A reason for the recommendation
   */
  _getRecommendationReason(concept, mastery) {
    const conceptMastery = mastery[concept.id] || { viewed: 0, passed: 0, confidence: 0 };
    
    // Already started
    if (conceptMastery.confidence > 0) {
      return 'Continue what you started';
    }
    
    // Check prerequisites
    const prerequisites = concept.prerequisites || [];
    if (prerequisites.length > 0) {
      let prereqsMasteredCount = 0;
      for (const prereqId of prerequisites) {
        if (mastery[prereqId] && mastery[prereqId].confidence >= 80) {
          prereqsMasteredCount++;
        }
      }
      
      if (prereqsMasteredCount === prerequisites.length) {
        return 'You\'ve mastered all prerequisites';
      } else if (prereqsMasteredCount > 0) {
        return `You've mastered ${prereqsMasteredCount}/${prerequisites.length} prerequisites`;
      }
    } else {
      return 'Beginner-friendly concept';
    }
    
    // Check dependents
    const dependents = Object.values(CORE_CONCEPTS).filter(c => 
      c.prerequisites && c.prerequisites.includes(concept.id)
    );
    
    if (dependents.length > 2) {
      return `Unlocks ${dependents.length} advanced concepts`;
    }
    
    return 'Recommended for your learning path';
  },
  
  // Get all related concepts (prerequisites and dependents)
  async getRelatedConcepts(conceptId) {
    const graph = await this.getGraph();
    const concept = graph[conceptId];
    if (!concept) return { prerequisites: [], dependents: [] };
    
    const prerequisites = concept.prerequisites.map(id => graph[id]).filter(Boolean);
    
    // Find concepts that have this as a prerequisite
    const dependents = Object.entries(graph)
      .filter(([id, c]) => c.prerequisites.includes(conceptId))
      .map(([id, c]) => ({ id, ...c }));
    
    return { prerequisites, dependents };
  }
};

export default conceptGraph;
