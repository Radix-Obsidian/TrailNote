/**
 * Action Definitions for Agent Builder
 * No-code abstractions for what agents can DO
 * Each action is self-contained and requires no coding knowledge
 */

import { store } from './storage.js';
import { nlu } from './nlu.js';
import { conceptGraph } from './concept-graph.js';

// Action categories for organization
const ACTION_CATEGORIES = {
  INPUT: 'input',      // Get information
  PROCESS: 'process',  // Transform/analyze information
  OUTPUT: 'output'     // Save/display information
};

/**
 * Base action structure
 * All actions follow this pattern for consistency
 */
const ACTION_SCHEMA = {
  id: '',           // Unique identifier
  name: '',         // Human-readable name
  description: '',  // What it does (for non-coders)
  category: '',     // INPUT, PROCESS, or OUTPUT
  inputs: [],       // What the action needs
  outputs: [],      // What the action produces
  execute: null     // The function to run
};

/**
 * Available Actions for Agents
 * These are the building blocks non-coders use to create agents
 */
export const ACTIONS = {
  
  // ============================================
  // INPUT ACTIONS - Get information
  // ============================================
  
  /**
   * READ_MEMORY - Read from agent's memory (notes)
   * No coding required - just specify what to look for
   */
  read_memory: {
    id: 'read_memory',
    name: 'Read from Memory',
    description: 'Look through your saved notes and knowledge',
    category: ACTION_CATEGORIES.INPUT,
    inputs: [
      { id: 'query', type: 'text', label: 'What are you looking for?', placeholder: 'e.g., "notes about flexbox"' }
    ],
    outputs: ['found_items', 'count'],
    async execute(params, context) {
      const { query } = params;
      
      // Get all notes from storage
      const notes = await store.get('hinthopper:notes', []);
      
      if (!query || query.trim() === '') {
        return { found_items: notes, count: notes.length };
      }
      
      // Use NLU to find relevant notes
      await nlu.init();
      const results = [];
      
      for (const note of notes) {
        const noteText = `${note.problem || ''} ${note.insight || ''} ${note.body || ''}`;
        const similarity = nlu.calculateSimilarity?.(query, noteText) || 
          (noteText.toLowerCase().includes(query.toLowerCase()) ? 0.8 : 0);
        
        if (similarity > 0.3) {
          results.push({ ...note, relevance: similarity });
        }
      }
      
      // Sort by relevance
      results.sort((a, b) => b.relevance - a.relevance);
      
      return { found_items: results, count: results.length };
    }
  },
  
  /**
   * READ_KNOWLEDGE_GRAPH - Get concepts and relationships
   */
  read_knowledge_graph: {
    id: 'read_knowledge_graph',
    name: 'Read Knowledge Graph',
    description: 'Explore connected concepts and their relationships',
    category: ACTION_CATEGORIES.INPUT,
    inputs: [
      { id: 'concept', type: 'text', label: 'Concept to explore (optional)', placeholder: 'e.g., "flexbox" or leave empty for all' }
    ],
    outputs: ['concepts', 'relationships'],
    async execute(params, context) {
      const { concept } = params;
      
      if (concept) {
        // Find specific concept
        const conceptId = await conceptGraph.findConceptFromText(concept);
        if (conceptId) {
          const conceptData = await conceptGraph.getConcept(conceptId);
          const related = await conceptGraph.getRelatedConcepts(conceptId);
          return { 
            concepts: [conceptData], 
            relationships: related 
          };
        }
        return { concepts: [], relationships: { prerequisites: [], dependents: [] } };
      }
      
      // Get all concepts
      const allConcepts = await conceptGraph.getGraph();
      return { 
        concepts: Object.values(allConcepts), 
        relationships: null 
      };
    }
  },
  
  /**
   * GET_CURRENT_CONTEXT - Get what the user is currently working on
   */
  get_current_context: {
    id: 'get_current_context',
    name: 'Get Current Context',
    description: 'See what challenge or topic the user is focused on right now',
    category: ACTION_CATEGORIES.INPUT,
    inputs: [],
    outputs: ['context'],
    async execute(params, context) {
      // Context is passed from the agent executor
      return { context: context || null };
    }
  },
  
  // ============================================
  // PROCESS ACTIONS - Transform/analyze
  // ============================================
  
  /**
   * SUMMARIZE - Create a concise summary
   */
  summarize: {
    id: 'summarize',
    name: 'Summarize',
    description: 'Turn long content into a short, clear summary',
    category: ACTION_CATEGORIES.PROCESS,
    inputs: [
      { id: 'content', type: 'text', label: 'Content to summarize', placeholder: 'Paste or reference content' },
      { id: 'style', type: 'select', label: 'Summary style', options: ['bullet points', 'one paragraph', 'key takeaways'] }
    ],
    outputs: ['summary'],
    async execute(params, context) {
      const { content, style = 'bullet points' } = params;
      
      if (!content) {
        return { summary: 'No content provided to summarize.' };
      }
      
      // For now, use simple extraction (LLM integration happens at executor level)
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
      
      if (style === 'bullet points') {
        const bullets = sentences.slice(0, 5).map(s => `• ${s.trim()}`);
        return { summary: bullets.join('\n') };
      } else if (style === 'one paragraph') {
        return { summary: sentences.slice(0, 3).join('. ').trim() + '.' };
      } else {
        // key takeaways
        const keywords = content.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
        const uniqueKeywords = [...new Set(keywords)].slice(0, 5);
        return { summary: `Key concepts: ${uniqueKeywords.join(', ')}` };
      }
    }
  },
  
  /**
   * FIND_PATTERNS - Identify recurring themes
   */
  find_patterns: {
    id: 'find_patterns',
    name: 'Find Patterns',
    description: 'Discover recurring themes, topics, or connections in content',
    category: ACTION_CATEGORIES.PROCESS,
    inputs: [
      { id: 'items', type: 'array', label: 'Items to analyze', placeholder: 'Usually from a previous action' }
    ],
    outputs: ['patterns', 'clusters'],
    async execute(params, context) {
      const { items } = params;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return { patterns: [], clusters: {} };
      }
      
      // Extract text from items
      const texts = items.map(item => {
        if (typeof item === 'string') return item;
        return `${item.problem || ''} ${item.insight || ''} ${item.body || ''} ${item.name || ''}`;
      });
      
      // Find common keywords
      await nlu.init();
      const allKeywords = {};
      
      for (const text of texts) {
        const keywords = nlu.extractKeywords?.(text) || {};
        for (const [word, score] of Object.entries(keywords)) {
          allKeywords[word] = (allKeywords[word] || 0) + score;
        }
      }
      
      // Sort by frequency
      const patterns = Object.entries(allKeywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, score]) => ({ term: word, frequency: Math.round(score * 100) / 100 }));
      
      // Create simple clusters
      const clusters = {};
      for (const pattern of patterns.slice(0, 5)) {
        clusters[pattern.term] = items.filter((item, idx) => 
          texts[idx].toLowerCase().includes(pattern.term)
        ).slice(0, 3);
      }
      
      return { patterns, clusters };
    }
  },
  
  /**
   * GENERATE_QUESTIONS - Create thought-provoking questions
   */
  generate_questions: {
    id: 'generate_questions',
    name: 'Generate Questions',
    description: 'Create questions to deepen understanding of a topic',
    category: ACTION_CATEGORIES.PROCESS,
    inputs: [
      { id: 'topic', type: 'text', label: 'Topic or content', placeholder: 'What should questions be about?' },
      { id: 'count', type: 'number', label: 'How many questions?', default: 3 }
    ],
    outputs: ['questions'],
    async execute(params, context) {
      const { topic, count = 3 } = params;
      
      if (!topic) {
        return { questions: ['What would you like to explore?'] };
      }
      
      // Generate questions based on topic keywords
      const keywords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      
      const questionTemplates = [
        `How does ${keywords[0] || 'this'} relate to what you already know?`,
        `What would happen if ${keywords[0] || 'this'} was different?`,
        `Why is ${keywords[0] || 'this'} important?`,
        `What are the practical applications of ${keywords[0] || 'this'}?`,
        `What misconceptions might someone have about ${keywords[0] || 'this'}?`,
        `How would you explain ${keywords[0] || 'this'} to a beginner?`,
        `What are the prerequisites for understanding ${keywords[0] || 'this'}?`,
        `What are common mistakes when learning ${keywords[0] || 'this'}?`
      ];
      
      // Shuffle and pick
      const shuffled = questionTemplates.sort(() => Math.random() - 0.5);
      const questions = shuffled.slice(0, Math.min(count, questionTemplates.length));
      
      return { questions };
    }
  },
  
  // ============================================
  // OUTPUT ACTIONS - Save/display
  // ============================================
  
  /**
   * SAVE_TO_MEMORY - Store results in agent's memory
   */
  save_to_memory: {
    id: 'save_to_memory',
    name: 'Save to Memory',
    description: 'Store information for the agent to remember later',
    category: ACTION_CATEGORIES.OUTPUT,
    inputs: [
      { id: 'title', type: 'text', label: 'Title', placeholder: 'What is this about?' },
      { id: 'content', type: 'textarea', label: 'Content to save', placeholder: 'The information to remember' },
      { id: 'tags', type: 'text', label: 'Tags (optional)', placeholder: '#topic #category' }
    ],
    outputs: ['saved', 'id'],
    async execute(params, context) {
      const { title, content, tags } = params;
      
      if (!content) {
        return { saved: false, id: null };
      }
      
      const notes = await store.get('hinthopper:notes', []);
      
      const newNote = {
        id: `note_${Date.now()}`,
        problem: title || 'Agent-generated note',
        insight: content.substring(0, 120),
        body: content,
        tags: tags || '',
        conceptId: null,
        createdAt: Date.now(),
        source: 'agent'
      };
      
      notes.push(newNote);
      await store.set('hinthopper:notes', notes);
      
      return { saved: true, id: newNote.id };
    }
  },
  
  /**
   * DISPLAY_RESULT - Show results to user
   */
  display_result: {
    id: 'display_result',
    name: 'Display Result',
    description: 'Show the results to the user in the chat interface',
    category: ACTION_CATEGORIES.OUTPUT,
    inputs: [
      { id: 'message', type: 'textarea', label: 'Message to display', placeholder: 'What should the user see?' },
      { id: 'format', type: 'select', label: 'Format', options: ['text', 'list', 'table'] }
    ],
    outputs: ['displayed'],
    async execute(params, context) {
      const { message, format = 'text' } = params;
      
      // The executor will handle actual display
      // This action just prepares the output
      return { 
        displayed: true, 
        output: {
          message,
          format,
          timestamp: Date.now()
        }
      };
    }
  },
  
  /**
   * UPDATE_KNOWLEDGE_GRAPH - Add or update concepts
   */
  update_knowledge_graph: {
    id: 'update_knowledge_graph',
    name: 'Update Knowledge Graph',
    description: 'Add new concepts or relationships to the knowledge graph',
    category: ACTION_CATEGORIES.OUTPUT,
    inputs: [
      { id: 'conceptName', type: 'text', label: 'Concept name', placeholder: 'Name of the concept' },
      { id: 'description', type: 'textarea', label: 'Description', placeholder: 'What is this concept about?' },
      { id: 'relatedTo', type: 'text', label: 'Related to (optional)', placeholder: 'Other concepts this connects to' }
    ],
    outputs: ['updated', 'conceptId'],
    async execute(params, context) {
      const { conceptName, description, relatedTo } = params;
      
      if (!conceptName || !description) {
        return { updated: false, conceptId: null };
      }
      
      const graph = await store.get('concept_graph', {});
      const conceptId = conceptName.toLowerCase().replace(/\s+/g, '-');
      
      graph[conceptId] = {
        id: conceptId,
        name: conceptName,
        description,
        tags: [conceptName.toLowerCase()],
        examples: [],
        prerequisites: relatedTo ? [relatedTo.toLowerCase().replace(/\s+/g, '-')] : [],
        createdAt: Date.now(),
        source: 'agent'
      };
      
      await store.set('concept_graph', graph);
      
      return { updated: true, conceptId };
    }
  }
};

/**
 * Get action by ID
 */
export function getAction(actionId) {
  return ACTIONS[actionId] || null;
}

/**
 * Get all available actions
 */
export function getAllActions() {
  return Object.values(ACTIONS);
}

/**
 * Get actions by category
 */
export function getActionsByCategory(category) {
  return Object.values(ACTIONS).filter(action => action.category === category);
}

/**
 * Validate action parameters
 */
export function validateActionParams(actionId, params) {
  const action = ACTIONS[actionId];
  if (!action) {
    return { valid: false, error: `Unknown action: ${actionId}` };
  }
  
  const errors = [];
  for (const input of action.inputs) {
    if (input.type === 'text' || input.type === 'textarea') {
      if (!params[input.id] && input.label && !input.placeholder?.includes('optional')) {
        // Allow empty for optional fields
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export default { ACTIONS, getAction, getAllActions, getActionsByCategory, validateActionParams };
