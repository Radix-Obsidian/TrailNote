/**
 * Adaptive Learning Path Generator
 * Analyzes struggle patterns and creates personalized learning paths
 */

import { conceptGraph } from './concept-graph.js';
import { store } from './storage.js';
import { struggleDetector } from './struggle-detector.js';

// Store key for adaptive learning data
const ADAPTIVE_LEARNING_KEY = 'hinthopper:adaptive_learning';

// Default adaptive learning data structure
const DEFAULT_ADAPTIVE_DATA = {
  learningPaths: {},        // Generated learning paths by user session
  strugglePatterns: {},     // Detected struggle patterns
  conceptDifficulty: {},    // Difficulty rating for concepts
  lastPathUpdate: null      // Timestamp of last path update
};

/**
 * Adaptive learning service
 */
export const adaptiveLearning = {
  /**
   * Initialize the adaptive learning module
   */
  async init() {
    try {
      await this._loadData();
      console.log('[HintHopper] Adaptive learning module initialized');
      return true;
    } catch (error) {
      console.error('[HintHopper] Error initializing adaptive learning:', error);
      return false;
    }
  },
  
  /**
   * Generate an adaptive learning path based on mastery and struggle patterns
   * @param {Array} conceptIds - Optional array of concept IDs to include 
   * @return {Object} Custom learning path with sequenced concepts
   */
  async generateLearningPath(conceptIds = []) {
    // Get all needed data
    const mastery = await conceptGraph.getAllMastery();
    const allConcepts = await conceptGraph.getAllConcepts();
    const struggleData = await struggleDetector.getStruggleData();
    
    // If specific concepts were requested, use those; otherwise use all concepts
    const targetConcepts = conceptIds.length > 0 
      ? conceptIds.filter(id => allConcepts[id])
      : Object.keys(allConcepts);
    
    if (targetConcepts.length === 0) {
      return { concepts: [], reason: 'No valid concepts found' };
    }
    
    // Calculate struggle-adjusted scores for each concept
    const conceptScores = {};
    
    for (const conceptId of targetConcepts) {
      const concept = allConcepts[conceptId];
      if (!concept) continue;
      
      const masteryData = mastery[conceptId] || { confidence: 0, viewed: 0 };
      
      // Base score starts with inverse of mastery (we want to focus on less mastered concepts)
      let score = 1 - (masteryData.confidence / 100);
      
      // Adjust for prerequisites - prioritize concepts whose prerequisites are mastered
      const prerequisites = concept.prerequisites || [];
      let prereqMasterySum = 0;
      
      if (prerequisites.length > 0) {
        for (const prereq of prerequisites) {
          const prereqMastery = mastery[prereq] || { confidence: 0 };
          prereqMasterySum += prereqMastery.confidence / 100;
        }
        
        // Normalize prerequisite score (0-1)
        const prereqScore = prerequisites.length > 0 
          ? prereqMasterySum / prerequisites.length 
          : 1;
          
        // Boost score for concepts with mastered prerequisites
        score *= (1 + prereqScore);
      }
      
      // Adjust for struggle patterns
      const conceptStruggleData = struggleData.conceptStruggle[conceptId];
      if (conceptStruggleData) {
        const struggleScore = Math.min(1, conceptStruggleData.level / 3);
        
        // Boost score for concepts with high struggle
        score *= (1 + struggleScore);
        
        // Extra boost for recently struggled concepts
        if (conceptStruggleData.lastDetected &&
            Date.now() - conceptStruggleData.lastDetected < 24 * 60 * 60 * 1000) {
          score *= 1.5;
        }
      }
      
      // Store final score
      conceptScores[conceptId] = score;
    }
    
    // Sort concepts by score (highest to lowest)
    const sortedConcepts = Object.entries(conceptScores)
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .map(([conceptId]) => conceptId);
    
    // Create learning path with concept sequence and metadata
    const learningPath = {
      id: `path_${Date.now()}`,
      created: Date.now(),
      concepts: sortedConcepts,
      metadata: {
        basePathType: 'adaptive',
        focusAreas: this._identifyFocusAreas(sortedConcepts, allConcepts, mastery),
        generatedFrom: {
          masteryDataPoints: Object.keys(mastery).length,
          struggleDataPoints: Object.keys(struggleData.conceptStruggle).length
        }
      },
      recommendation: this._generatePathDescription(sortedConcepts, allConcepts, mastery, struggleData)
    };
    
    // Save this path
    this._data.learningPaths[learningPath.id] = learningPath;
    this._data.lastPathUpdate = Date.now();
    await this._saveData();
    
    return learningPath;
  },
  
  /**
   * Get adaptive recommendations based on struggle pattern detection
   * @param {string} conceptId - Current concept being viewed
   * @return {Object} Recommendations including next steps and focus areas
   */
  async getAdaptiveRecommendations(conceptId) {
    // Get current concept
    const concept = await conceptGraph.getConcept(conceptId);
    if (!concept) {
      return {
        nextSteps: [],
        message: "Couldn't find concept data"
      };
    }
    
    // Get mastery and struggle data
    const mastery = await conceptGraph.getAllMastery();
    const struggleData = await struggleDetector.getStruggleData();
    const allConcepts = await conceptGraph.getAllConcepts();
    
    // Check if we have detected struggles with this concept
    const conceptStruggle = struggleData.conceptStruggle[conceptId];
    const currentMastery = mastery[conceptId] || { confidence: 0 };
    
    // Different recommendation strategies based on struggle and mastery
    if (conceptStruggle && conceptStruggle.level >= 2) {
      // High struggle strategy
      return this._generateHighStruggleRecommendation(
        conceptId, 
        concept, 
        mastery, 
        struggleData, 
        allConcepts
      );
    } else if (currentMastery.confidence < 30) {
      // Low mastery strategy
      return this._generateLowMasteryRecommendation(
        conceptId, 
        concept, 
        mastery, 
        allConcepts
      );
    } else {
      // Standard progression strategy
      return this._generateStandardRecommendation(
        conceptId, 
        concept, 
        mastery, 
        allConcepts
      );
    }
  },
  
  /**
   * Track concept struggle and update difficulty ratings
   * @param {string} conceptId - Concept ID
   * @param {number} struggleLevel - Struggle level (0-3)
   */
  async trackConceptStruggle(conceptId, struggleLevel) {
    if (!conceptId) return;
    
    // Update concept difficulty rating
    if (!this._data.conceptDifficulty[conceptId]) {
      this._data.conceptDifficulty[conceptId] = {
        rating: 1, // Default difficulty (1-5)
        dataPoints: 0
      };
    }
    
    const difficulty = this._data.conceptDifficulty[conceptId];
    
    // Convert struggle level to difficulty increment
    const difficultyIncrement = {
      0: -0.1,  // No struggle decreases difficulty slightly
      1: 0.1,   // Slight struggle increases slightly
      2: 0.2,   // Moderate struggle increases moderately
      3: 0.3    // High struggle increases significantly
    }[struggleLevel] || 0;
    
    // Update rating with moving average
    difficulty.rating = Math.max(1, Math.min(5, 
      (difficulty.rating * difficulty.dataPoints + (difficulty.rating + difficultyIncrement)) / 
      (difficulty.dataPoints + 1)
    ));
    
    difficulty.dataPoints++;
    
    await this._saveData();
  },
  
  /**
   * Get difficulty rating for a concept
   * @param {string} conceptId - Concept ID
   * @return {number} Difficulty rating from 1-5
   */
  async getConceptDifficulty(conceptId) {
    if (!conceptId) return 1;
    
    const difficulty = this._data.conceptDifficulty[conceptId];
    return difficulty ? difficulty.rating : 1;
  },
  
  /**
   * Analyze a user's learning journey and provide insights
   * @return {Object} Analysis of learning journey and recommendations
   */
  async analyzeLearningJourney() {
    const mastery = await conceptGraph.getAllMastery();
    const allConcepts = await conceptGraph.getAllConcepts();
    const struggleData = await struggleDetector.getStruggleData();
    
    // Count concepts at each mastery level
    const masteryCounts = {
      mastered: 0,
      familiar: 0,
      learning: 0,
      notStarted: 0
    };
    
    for (const conceptId in allConcepts) {
      const masteryData = mastery[conceptId] || { confidence: 0 };
      if (masteryData.confidence >= 80) {
        masteryCounts.mastered++;
      } else if (masteryData.confidence >= 50) {
        masteryCounts.familiar++;
      } else if (masteryData.confidence > 0) {
        masteryCounts.learning++;
      } else {
        masteryCounts.notStarted++;
      }
    }
    
    // Find areas of struggle
    const struggleAreas = [];
    for (const conceptId in struggleData.conceptStruggle) {
      if (struggleData.conceptStruggle[conceptId].level >= 2) {
        const concept = allConcepts[conceptId];
        if (concept) {
          struggleAreas.push({
            id: conceptId,
            name: concept.name,
            level: struggleData.conceptStruggle[conceptId].level
          });
        }
      }
    }
    
    // Calculate overall progress
    const totalConcepts = Object.keys(allConcepts).length;
    const progress = totalConcepts > 0 ? 
      (masteryCounts.mastered + (0.5 * masteryCounts.familiar)) / totalConcepts : 0;
    
    // Generate overall recommendation
    let recommendationMessage = '';
    if (progress < 0.2) {
      recommendationMessage = 'Focus on building a strong foundation with basic concepts.';
    } else if (progress < 0.5) {
      recommendationMessage = 'Continue working on the core concepts and start exploring related areas.';
    } else if (progress < 0.8) {
      recommendationMessage = 'You have a good grasp of most concepts. Focus on mastering the remaining challenging areas.';
    } else {
      recommendationMessage = 'Excellent progress! Consider going deeper into advanced topics.';
    }
    
    // Generate focus areas
    const focusAreas = this._identifyFocusAreas(
      Object.keys(allConcepts), 
      allConcepts, 
      mastery
    ).slice(0, 3);
    
    return {
      progress: {
        overall: progress,
        mastered: masteryCounts.mastered,
        familiar: masteryCounts.familiar,
        learning: masteryCounts.learning,
        notStarted: masteryCounts.notStarted,
        total: totalConcepts
      },
      struggleAreas: struggleAreas.slice(0, 5),
      recommendation: recommendationMessage,
      focusAreas
    };
  },
  
  // Private data storage
  _data: { ...DEFAULT_ADAPTIVE_DATA },
  
  /**
   * Load adaptive learning data from storage
   * @private
   */
  async _loadData() {
    this._data = await store.get(ADAPTIVE_LEARNING_KEY, DEFAULT_ADAPTIVE_DATA);
  },
  
  /**
   * Save adaptive learning data to storage
   * @private
   */
  async _saveData() {
    await store.set(ADAPTIVE_LEARNING_KEY, this._data);
  },
  
  /**
   * Generate a description of the learning path
   * @private
   */
  _generatePathDescription(sortedConcepts, allConcepts, mastery, struggleData) {
    if (sortedConcepts.length === 0) {
      return 'Personalized learning path';
    }
    
    // Check if path targets struggle areas
    let struggleCount = 0;
    for (const conceptId of sortedConcepts.slice(0, 3)) {
      if (struggleData.conceptStruggle[conceptId] && 
          struggleData.conceptStruggle[conceptId].level >= 2) {
        struggleCount++;
      }
    }
    
    const hasStruggleAreas = struggleCount >= 2;
    
    // Check if path targets prerequisite gaps
    let hasPrereqGaps = false;
    for (const conceptId of sortedConcepts.slice(0, 3)) {
      const concept = allConcepts[conceptId];
      if (!concept || !concept.prerequisites) continue;
      
      for (const prereq of concept.prerequisites) {
        const prereqMastery = mastery[prereq] || { confidence: 0 };
        if (prereqMastery.confidence < 50) {
          hasPrereqGaps = true;
          break;
        }
      }
      if (hasPrereqGaps) break;
    }
    
    // Generate description based on characteristics
    if (hasStruggleAreas && hasPrereqGaps) {
      return 'Focus path targeting struggle areas and building missing foundations';
    } else if (hasStruggleAreas) {
      return 'Targeted path to overcome identified struggle areas';
    } else if (hasPrereqGaps) {
      return 'Foundation-building path to fill prerequisite gaps';
    } else {
      return 'Balanced progress path for steady advancement';
    }
  },
  
  /**
   * Identify focus areas from a set of concepts
   * @private
   */
  _identifyFocusAreas(conceptIds, allConcepts, mastery) {
    const focusAreas = [];
    const categoryGroups = {};
    
    // Group concepts by category
    for (const conceptId of conceptIds) {
      const concept = allConcepts[conceptId];
      if (!concept) continue;
      
      const category = concept.category || 'general';
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      
      categoryGroups[category].push({
        id: conceptId,
        name: concept.name,
        mastery: (mastery[conceptId] || { confidence: 0 }).confidence
      });
    }
    
    // Find categories with lowest average mastery
    const categoryScores = [];
    for (const [category, concepts] of Object.entries(categoryGroups)) {
      if (concepts.length < 2) continue; // Skip categories with just one concept
      
      const avgMastery = concepts.reduce((sum, c) => sum + c.mastery, 0) / concepts.length;
      categoryScores.push({
        category,
        avgMastery,
        conceptCount: concepts.length
      });
    }
    
    // Sort categories by lowest mastery
    categoryScores.sort((a, b) => a.avgMastery - b.avgMastery);
    
    // Generate focus areas
    for (const { category, avgMastery } of categoryScores) {
      let description = '';
      
      if (avgMastery < 30) {
        description = `Build foundations in ${category}`;
      } else if (avgMastery < 60) {
        description = `Strengthen your ${category} skills`;
      } else {
        description = `Master advanced ${category} concepts`;
      }
      
      focusAreas.push({
        category,
        avgMastery,
        description
      });
    }
    
    return focusAreas;
  },
  
  /**
   * Generate recommendations for high struggle cases
   * @private
   */
  _generateHighStruggleRecommendation(conceptId, concept, mastery, struggleData, allConcepts) {
    // For high struggle, we want to check prerequisites and possibly suggest alternatives
    const prerequisites = concept.prerequisites || [];
    const missingPrereqs = [];
    
    // Check prerequisites
    for (const prereqId of prerequisites) {
      const prereqMastery = mastery[prereqId] || { confidence: 0 };
      if (prereqMastery.confidence < 50) {
        const prereqConcept = allConcepts[prereqId];
        if (prereqConcept) {
          missingPrereqs.push({
            id: prereqId,
            name: prereqConcept.name,
            confidence: prereqMastery.confidence
          });
        }
      }
    }
    
    // Find alternative paths to the same knowledge
    const alternatives = [];
    for (const [altId, altConcept] of Object.entries(allConcepts)) {
      if (altId === conceptId) continue;
      if (altConcept.category === concept.category && 
          altConcept.difficulty < (this._data.conceptDifficulty[conceptId]?.rating || 3)) {
        alternatives.push({
          id: altId,
          name: altConcept.name
        });
      }
    }
    
    // Generate recommendations
    const nextSteps = [];
    
    // First suggest addressing prerequisite gaps
    if (missingPrereqs.length > 0) {
      nextSteps.push({
        type: 'prerequisite',
        message: 'Review these foundation concepts first:',
        concepts: missingPrereqs.slice(0, 3)
      });
    }
    
    // Suggest breaking down the concept
    nextSteps.push({
      type: 'breakdown',
      message: 'Break down this concept into smaller parts',
      details: 'Focus on one aspect at a time instead of the whole concept'
    });
    
    // Suggest alternative approaches if available
    if (alternatives.length > 0) {
      nextSteps.push({
        type: 'alternative',
        message: 'Try these alternative approaches:',
        concepts: alternatives.slice(0, 2)
      });
    }
    
    return {
      nextSteps,
      message: "We've noticed you're finding this challenging. Let's try a different approach.",
      struggleLevel: struggleData.conceptStruggle[conceptId].level
    };
  },
  
  /**
   * Generate recommendations for low mastery cases
   * @private
   */
  _generateLowMasteryRecommendation(conceptId, concept, mastery, allConcepts) {
    const nextSteps = [];
    
    // Check prerequisites
    const prerequisites = concept.prerequisites || [];
    const completedPrereqs = prerequisites.filter(prereqId => {
      const prereqMastery = mastery[prereqId] || { confidence: 0 };
      return prereqMastery.confidence >= 50;
    });
    
    // If not all prerequisites are completed, suggest them
    if (completedPrereqs.length < prerequisites.length) {
      const missingPrereqs = prerequisites
        .filter(prereqId => !completedPrereqs.includes(prereqId))
        .map(prereqId => {
          const prereqConcept = allConcepts[prereqId];
          return prereqConcept ? {
            id: prereqId,
            name: prereqConcept.name,
            confidence: (mastery[prereqId] || { confidence: 0 }).confidence
          } : null;
        })
        .filter(Boolean);
      
      if (missingPrereqs.length > 0) {
        nextSteps.push({
          type: 'prerequisite',
          message: 'Complete these prerequisites first:',
          concepts: missingPrereqs.slice(0, 3)
        });
      }
    }
    
    // Suggest practical exercises
    nextSteps.push({
      type: 'practice',
      message: 'Try some practical exercises',
      details: 'Apply this concept in small practice examples'
    });
    
    // Suggest related concepts at similar level
    const relatedConcepts = [];
    for (const [relatedId, relatedConcept] of Object.entries(allConcepts)) {
      if (relatedId === conceptId) continue;
      
      // Check if it's related (same category or shares prerequisites)
      const sameCategory = relatedConcept.category === concept.category;
      const sharedPrereqs = (relatedConcept.prerequisites || []).some(p => 
        prerequisites.includes(p)
      );
      
      if ((sameCategory || sharedPrereqs) && 
          (mastery[relatedId]?.confidence || 0) <= 30) {
        relatedConcepts.push({
          id: relatedId,
          name: relatedConcept.name
        });
      }
    }
    
    if (relatedConcepts.length > 0) {
      nextSteps.push({
        type: 'related',
        message: 'Explore these related concepts:',
        concepts: relatedConcepts.slice(0, 2)
      });
    }
    
    return {
      nextSteps,
      message: "Build your understanding step by step.",
      masteryLevel: "beginner"
    };
  },
  
  /**
   * Generate standard progression recommendations
   * @private
   */
  _generateStandardRecommendation(conceptId, concept, mastery, allConcepts) {
    const currentMastery = mastery[conceptId] || { confidence: 0 };
    const nextSteps = [];
    
    // For mid-level mastery, suggest advancing to next concepts
    if (currentMastery.confidence >= 30 && currentMastery.confidence < 80) {
      nextSteps.push({
        type: 'practice',
        message: 'Continue practicing this concept',
        details: 'Try more complex examples to deepen understanding'
      });
    }
    
    // Find dependent concepts (concepts that have this as a prerequisite)
    const dependents = [];
    for (const [id, otherConcept] of Object.entries(allConcepts)) {
      if ((otherConcept.prerequisites || []).includes(conceptId)) {
        dependents.push({
          id,
          name: otherConcept.name,
          mastery: (mastery[id] || { confidence: 0 }).confidence
        });
      }
    }
    
    // Sort dependents by mastery (ascending)
    dependents.sort((a, b) => a.mastery - b.mastery);
    
    if (dependents.length > 0) {
      nextSteps.push({
        type: 'next',
        message: 'Ready to explore these next concepts:',
        concepts: dependents.slice(0, 3)
      });
    }
    
    // Suggest advanced applications if mastery is high
    if (currentMastery.confidence >= 70) {
      nextSteps.push({
        type: 'advanced',
        message: 'Try advanced applications',
        details: 'Combine this with other concepts for complex projects'
      });
    }
    
    return {
      nextSteps,
      message: currentMastery.confidence >= 80 
        ? "You've mastered this concept! Ready for advanced applications."
        : "You're making good progress. Keep going!",
      masteryLevel: currentMastery.confidence >= 80 
        ? "master" 
        : currentMastery.confidence >= 50 
          ? "familiar" 
          : "learning"
    };
  }
};

export default adaptiveLearning;
