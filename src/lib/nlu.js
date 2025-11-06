/**
 * Natural Language Understanding Module
 * Provides advanced semantic analysis for better hint relevance
 */

import { conceptGraph } from './concept-graph.js';
import { store } from './store.js';

// Store key for NLU data
const NLU_STORE_KEY = 'hinthopper:nlu_data';

// Default NLU data structure
const DEFAULT_NLU_DATA = {
  queryHistory: [],       // Recent query history for context
  embeddings: {},         // Simple local embeddings for terms
  conceptPhrases: {},     // Phrases associated with concepts
  lastUpdated: null       // Timestamp of last update
};

/**
 * Simple TF-IDF implementation for keyword extraction
 * @param {string} text - Text to analyze
 * @param {Array} corpus - Array of documents for comparison
 * @return {Object} Keywords with scores
 */
function extractKeywords(text, corpus) {
  if (!text) return {};
  
  // Tokenize and clean text
  const tokens = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.includes(token));
  
  // Calculate term frequency
  const tf = {};
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });
  
  // If we don't have a corpus, just return term frequency
  if (!corpus || corpus.length === 0) {
    return Object.entries(tf)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        obj[key] = value / tokens.length;
        return obj;
      }, {});
  }
  
  // Calculate document frequency
  const df = {};
  for (const token in tf) {
    let count = 0;
    for (const doc of corpus) {
      if (doc.toLowerCase().includes(token)) {
        count++;
      }
    }
    df[token] = count || 1;
  }
  
  // Calculate TF-IDF
  const tfidf = {};
  const docCount = corpus.length || 1;
  for (const token in tf) {
    tfidf[token] = (tf[token] / tokens.length) * Math.log(docCount / df[token]);
  }
  
  // Sort by score
  return Object.entries(tfidf)
    .sort((a, b) => b[1] - a[1])
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});
}

/**
 * Calculate semantic similarity between two texts
 * Uses a very simple vector space model with TF-IDF weights
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @return {number} Similarity score between 0-1
 */
function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const corpus = [text1, text2];
  
  // Get keywords for both texts
  const keywords1 = extractKeywords(text1, corpus);
  const keywords2 = extractKeywords(text2, corpus);
  
  // Find all unique keywords
  const allKeywords = [...new Set([
    ...Object.keys(keywords1),
    ...Object.keys(keywords2)
  ])];
  
  // Calculate dot product
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (const keyword of allKeywords) {
    const val1 = keywords1[keyword] || 0;
    const val2 = keywords2[keyword] || 0;
    
    dotProduct += val1 * val2;
    magnitude1 += val1 * val1;
    magnitude2 += val2 * val2;
  }
  
  // Prevent division by zero
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  // Calculate cosine similarity
  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}

// Common stop words to ignore
const STOP_WORDS = [
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for',
  'if', 'in', 'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or',
  'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they',
  'this', 'to', 'was', 'will', 'with', 'what', 'when', 'where', 'why'
];

/**
 * Natural language understanding service
 */
export const nlu = {
  /**
   * Initialize the NLU module and build initial concept phrases
   */
  async init() {
    try {
      await this._loadData();
      
      // Build concept phrases if needed
      if (Object.keys(this._data.conceptPhrases).length === 0 || 
          !this._data.lastUpdated || 
          Date.now() - this._data.lastUpdated > 7 * 24 * 60 * 60 * 1000) { // 1 week
        await this._buildConceptPhrases();
      }
      
      console.log('[HintHopper] NLU module initialized');
      return true;
    } catch (error) {
      console.error('[HintHopper] Error initializing NLU module:', error);
      return false;
    }
  },
  
  /**
   * Analyze a user query and extract concepts, keywords, and intent
   * @param {string} query - User's question or search query
   * @param {Object} context - Code context or problem statement
   * @return {Object} Analysis of the query
   */
  async analyzeQuery(query, context = {}) {
    if (!query) return null;
    
    // Extract keywords from query
    const queryKeywords = extractKeywords(query, this._data.queryHistory.slice(-20));
    
    // Record query for future context
    this._data.queryHistory.push(query);
    if (this._data.queryHistory.length > 100) {
      this._data.queryHistory.shift(); // Keep history manageable
    }
    await this._saveData();
    
    // Find related concepts based on keyword similarity
    const conceptScores = {};
    const concepts = await conceptGraph.getAllConcepts();
    
    for (const [conceptId, concept] of Object.entries(concepts)) {
      // Skip concepts without content
      if (!concept.name || !concept.description) continue;
      
      // Calculate similarity to concept name and description
      const nameSimilarity = calculateSimilarity(
        query, 
        concept.name
      );
      
      const descSimilarity = calculateSimilarity(
        query, 
        concept.description
      );
      
      // Check for phrases in query
      let phraseMatch = 0;
      const phrases = this._data.conceptPhrases[conceptId] || [];
      for (const phrase of phrases) {
        if (query.toLowerCase().includes(phrase.toLowerCase())) {
          phraseMatch += 0.25; // Bonus for phrase matches
        }
      }
      
      // Check context code if available
      let codeSimilarity = 0;
      if (context.code) {
        const codeKeywords = extractKeywords(context.code);
        const conceptKeywords = extractKeywords(concept.description);
        
        // Calculate simple overlap score
        let overlap = 0;
        for (const keyword in codeKeywords) {
          if (conceptKeywords[keyword]) {
            overlap += codeKeywords[keyword] * conceptKeywords[keyword];
          }
        }
        codeSimilarity = overlap / Math.max(1, Object.keys(codeKeywords).length);
      }
      
      // Calculate final score weighted by importance
      conceptScores[conceptId] = 
        (nameSimilarity * 0.4) + 
        (descSimilarity * 0.3) + 
        (phraseMatch * 0.2) +
        (codeSimilarity * 0.1);
    }
    
    // Find top concepts
    const topConcepts = Object.entries(conceptScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([conceptId, score]) => ({ conceptId, score }));
    
    return {
      keywords: Object.keys(queryKeywords).slice(0, 10),
      topConcepts,
      query
    };
  },
  
  /**
   * Score the relevance of a hint for a particular query
   * @param {Object} hint - The hint to score
   * @param {Object} analysis - Query analysis from analyzeQuery()
   * @return {number} Relevance score between 0-1
   */
  scoreHintRelevance(hint, analysis) {
    if (!hint || !analysis) return 0;
    
    let score = 0;
    
    // Check concept match
    if (hint.conceptKey) {
      const conceptMatch = analysis.topConcepts.find(c => 
        c.conceptId === hint.conceptKey
      );
      
      if (conceptMatch) {
        score += conceptMatch.score * 0.5; // 50% weight for concept match
      }
    }
    
    // Check content similarity to query
    const hintContent = [
      hint.diagnosis || '',
      hint.why_it_happens || '',
      ...(hint.steps || [])
    ].join(' ');
    
    const contentSimilarity = calculateSimilarity(analysis.query, hintContent);
    score += contentSimilarity * 0.5; // 50% weight for content similarity
    
    return Math.min(1, Math.max(0, score));
  },
  
  /**
   * Suggest a better query based on user's query and code context
   * @param {string} query - User's original query
   * @param {Object} context - Code context
   * @return {string} Suggested improved query
   */
  async suggestBetterQuery(query, context = {}) {
    const analysis = await this.analyzeQuery(query, context);
    if (!analysis || analysis.topConcepts.length === 0) {
      return query;
    }
    
    // Get the top concept
    const topConceptId = analysis.topConcepts[0].conceptId;
    const concept = await conceptGraph.getConcept(topConceptId);
    
    if (!concept) return query;
    
    // Extract main topic from query
    const queryWords = query.split(/\s+/).filter(w => !STOP_WORDS.includes(w.toLowerCase()));
    
    // Combine original query intent with more precise concept terminology
    let betterQuery = query;
    if (concept.name && !query.toLowerCase().includes(concept.name.toLowerCase())) {
      betterQuery = `${query} ${concept.name}`;
    }
    
    return betterQuery;
  },
  
  // Private data storage
  _data: { ...DEFAULT_NLU_DATA },
  
  /**
   * Load NLU data from storage
   * @private
   */
  async _loadData() {
    this._data = await store.get(NLU_STORE_KEY, DEFAULT_NLU_DATA);
  },
  
  /**
   * Save NLU data to storage
   * @private
   */
  async _saveData() {
    await store.set(NLU_STORE_KEY, this._data);
  },
  
  /**
   * Build concept phrases for better matching
   * @private
   */
  async _buildConceptPhrases() {
    const concepts = await conceptGraph.getAllConcepts();
    const conceptPhrases = {};
    
    for (const [conceptId, concept] of Object.entries(concepts)) {
      if (!concept.name || !concept.description) continue;
      
      // Extract phrases from name and description
      const phrases = [
        concept.name,
        ...this._extractPhrases(concept.description)
      ];
      
      conceptPhrases[conceptId] = Array.from(new Set(phrases));
    }
    
    this._data.conceptPhrases = conceptPhrases;
    this._data.lastUpdated = Date.now();
    await this._saveData();
  },
  
  /**
   * Extract meaningful phrases from text
   * @private
   * @param {string} text - Text to extract phrases from
   * @return {Array} Array of extracted phrases
   */
  _extractPhrases(text) {
    if (!text) return [];
    
    // Simple phrase extraction based on punctuation and common patterns
    const sentences = text.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10 && s.length < 100);
    
    const phrases = [];
    
    // Extract phrases like "X is Y" or "X are Y"
    const isPattern = /(\w+(?:\s+\w+){0,3})\s+(?:is|are)\s+(\w+(?:\s+\w+){0,3})/gi;
    for (const sentence of sentences) {
      let match;
      while ((match = isPattern.exec(sentence)) !== null) {
        if (match[1] && match[1].length > 3) phrases.push(match[1]);
        if (match[2] && match[2].length > 3) phrases.push(match[2]);
      }
    }
    
    // Extract phrases after "like", "such as", "called"
    const examplePattern = /(?:like|such as|called)\s+(\w+(?:\s+\w+){0,3})/gi;
    for (const sentence of sentences) {
      let match;
      while ((match = examplePattern.exec(sentence)) !== null) {
        if (match[1] && match[1].length > 3) phrases.push(match[1]);
      }
    }
    
    // Extract noun phrases (simple heuristic)
    const nounPhrasePattern = /(?:the|a|an)\s+(\w+(?:\s+\w+){0,2}\s+(?:element|property|attribute|tag|selector|value))/gi;
    for (const sentence of sentences) {
      let match;
      while ((match = nounPhrasePattern.exec(sentence)) !== null) {
        if (match[1] && match[1].length > 3) phrases.push(match[1]);
      }
    }
    
    return phrases.filter(p => p.length > 3);
  }
};

export default nlu;
