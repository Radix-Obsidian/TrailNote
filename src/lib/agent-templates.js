/**
 * Agent Templates - Pre-built agent patterns
 * Zero-to-one agents that non-coders can deploy instantly
 * Each template demonstrates a complete Perception → Reasoning → Action loop
 */

import { ACTIONS } from './action-definitions.js';

/**
 * Template structure
 * Each template is a complete, working agent configuration
 */
const TEMPLATE_SCHEMA = {
  id: '',              // Unique identifier
  name: '',            // Human-readable name
  description: '',     // What this agent does (for non-coders)
  difficulty: '',      // 'beginner', 'intermediate', 'advanced'
  timeToDeploy: '',    // Estimated time to deploy
  actions: [],         // Sequence of actions to execute
  behavior: {},        // Agent behavior configuration
  onboarding: {}       // Guidance for first-time users
};

/**
 * Pre-built Agent Templates
 * These are the starting points for non-coders
 */
export const AGENT_TEMPLATES = {

  // ============================================
  // KNOWLEDGE CURATOR - The "Hello World" of agents
  // ============================================
  
  knowledge_curator: {
    id: 'knowledge_curator',
    name: 'Knowledge Curator',
    description: 'Organizes your scattered notes into structured knowledge. Finds patterns, creates summaries, and builds your personal knowledge base.',
    difficulty: 'beginner',
    timeToDeploy: '2 minutes',
    
    // What the agent does (in plain language)
    purpose: 'Turn messy notes into organized knowledge',
    
    // The action sequence this agent performs
    actions: [
      {
        actionId: 'read_memory',
        params: { query: '' }, // Empty = read all
        description: 'Read all your saved notes'
      },
      {
        actionId: 'find_patterns',
        params: { items: '${previous.found_items}' }, // Reference previous output
        description: 'Discover recurring themes'
      },
      {
        actionId: 'summarize',
        params: { 
          content: '${previous.patterns}',
          style: 'key takeaways'
        },
        description: 'Create a summary of patterns'
      },
      {
        actionId: 'display_result',
        params: {
          message: 'I found ${previous.count} patterns in your notes. Here are the key themes:\n\n${previous.summary}',
          format: 'text'
        },
        description: 'Show results to user'
      }
    ],
    
    // Behavior configuration
    behavior: {
      trigger: 'manual',        // 'manual', 'scheduled', 'event'
      requiresConfirmation: false,
      showProgress: true,       // Show "thinking" indicator
      notifyOnComplete: true,
      maxExecutionTime: 30000,  // 30 seconds
      retryOnFailure: true,
      retryCount: 2
    },
    
    // Onboarding guidance
    onboarding: {
      welcomeMessage: "Hi! I'm your Knowledge Curator. I'll help organize your notes into structured knowledge.",
      steps: [
        "First, I'll read through all your saved notes",
        "Then I'll look for patterns and recurring themes",
        "Finally, I'll summarize what I found and save it for you"
      ],
      example: "If you have notes about 'flexbox', 'grid', and 'position', I'll notice they're all about CSS layout and group them together.",
      tips: [
        "The more notes you have, the better I work",
        "Run me weekly to keep your knowledge organized",
        "I learn from patterns, so consistent note-taking helps"
      ]
    },
    
    // Customization options (for advanced users)
    customization: {
      canModifyActions: true,
      canAddActions: true,
      canChangeTrigger: true,
      availableParams: ['query', 'style', 'count']
    }
  },

  // ============================================
  // LEARNING COMPANION - Deepens understanding
  // ============================================
  
  learning_companion: {
    id: 'learning_companion',
    name: 'Learning Companion',
    description: 'Helps you deeply understand any topic by generating questions, finding knowledge gaps, and creating study guides.',
    difficulty: 'beginner',
    timeToDeploy: '3 minutes',
    
    purpose: 'Deepen your understanding through guided questions',
    
    actions: [
      {
        actionId: 'get_current_context',
        params: {},
        description: "See what you're currently learning"
      },
      {
        actionId: 'read_knowledge_graph',
        params: { concept: '${context.topic}' },
        description: 'Find related concepts'
      },
      {
        actionId: 'generate_questions',
        params: {
          topic: '${context.topic}',
          count: 5
        },
        description: 'Create thought-provoking questions'
      },
      {
        actionId: 'display_result',
        params: {
          message: "Let's deepen your understanding of **${context.topic}**:\n\n${previous.questions}\n\nThink about these questions. Would you like hints for any of them?",
          format: 'list'
        },
        description: 'Present questions to user'
      }
    ],
    
    behavior: {
      trigger: 'manual',
      requiresConfirmation: false,
      showProgress: true,
      notifyOnComplete: true,
      maxExecutionTime: 20000,
      retryOnFailure: true,
      retryCount: 2,
      // Special: interactive mode
      interactive: true,
      waitForUserResponse: true
    },
    
    onboarding: {
      welcomeMessage: "I'm your Learning Companion! I help you think deeper about any topic.",
      steps: [
        "Tell me what topic you're learning",
        "I'll find related concepts in your knowledge graph",
        "I'll generate questions to deepen your understanding",
        "We can discuss any question you find interesting"
      ],
      example: "Learning about 'flexbox'? I'll ask questions like 'How does flexbox relate to grid?' and 'What happens if you change flex-direction?'",
      tips: [
        "Answer questions out loud or write them down",
        "If a question stumps you, ask for a hint",
        "The goal is thinking, not right answers"
      ]
    },
    
    customization: {
      canModifyActions: true,
      canAddActions: true,
      canChangeTrigger: true,
      availableParams: ['topic', 'count', 'difficulty']
    }
  },

  // ============================================
  // NOTE SYNTHESIZER - Creates new insights
  // ============================================
  
  note_synthesizer: {
    id: 'note_synthesizer',
    name: 'Note Synthesizer',
    description: 'Combines multiple notes into synthesized insights. Great for review sessions or creating study materials.',
    difficulty: 'intermediate',
    timeToDeploy: '5 minutes',
    
    purpose: 'Combine scattered notes into cohesive insights',
    
    actions: [
      {
        actionId: 'read_memory',
        params: { query: '${userInput.topic}' },
        description: 'Find notes on a specific topic'
      },
      {
        actionId: 'find_patterns',
        params: { items: '${previous.found_items}' },
        description: 'Identify connections between notes'
      },
      {
        actionId: 'summarize',
        params: {
          content: '${previous.found_items}',
          style: 'bullet points'
        },
        description: 'Create a structured summary'
      },
      {
        actionId: 'generate_questions',
        params: {
          topic: '${userInput.topic}',
          count: 3
        },
        description: 'Generate review questions'
      },
      {
        actionId: 'save_to_memory',
        params: {
          title: 'Synthesis: ${userInput.topic}',
          content: '${previous.summary}\n\nReview Questions:\n${previous.questions}',
          tags: '#synthesis #${userInput.topic}'
        },
        description: 'Save the synthesized knowledge'
      },
      {
        actionId: 'display_result',
        params: {
          message: "I've synthesized your notes on **${userInput.topic}**:\n\n${previous.summary}\n\n✅ Saved to your memory for later review.",
          format: 'text'
        },
        description: 'Show the synthesis'
      }
    ],
    
    behavior: {
      trigger: 'manual',
      requiresConfirmation: true,  // Confirm before saving
      showProgress: true,
      notifyOnComplete: true,
      maxExecutionTime: 45000,
      retryOnFailure: true,
      retryCount: 2
    },
    
    onboarding: {
      welcomeMessage: "I'm your Note Synthesizer! I combine your notes into powerful summaries.",
      steps: [
        "Tell me what topic you want to synthesize",
        "I'll gather all related notes",
        "I'll find patterns and create a summary",
        "I'll save it as a new synthesized note"
      ],
      example: "Have notes about 'CSS layout' scattered across sessions? I'll combine them into one master note with key patterns and review questions.",
      tips: [
        "Run me after completing a learning module",
        "Review synthesized notes before interviews or projects",
        "I work best with 5+ related notes"
      ]
    },
    
    customization: {
      canModifyActions: true,
      canAddActions: true,
      canChangeTrigger: true,
      availableParams: ['topic', 'style', 'includeQuestions']
    }
  },

  // ============================================
  // KNOWLEDGE GAP FINDER - Identifies what you don't know
  // ============================================
  
  knowledge_gap_finder: {
    id: 'knowledge_gap_finder',
    name: 'Knowledge Gap Finder',
    description: 'Analyzes your knowledge graph to find concepts you should learn next. Perfect for planning your learning journey.',
    difficulty: 'intermediate',
    timeToDeploy: '4 minutes',
    
    purpose: 'Identify knowledge gaps and learning opportunities',
    
    actions: [
      {
        actionId: 'read_knowledge_graph',
        params: {},
        description: 'Get your complete knowledge graph'
      },
      {
        actionId: 'find_patterns',
        params: { items: '${previous.concepts}' },
        description: 'Analyze concept mastery patterns'
      },
      {
        actionId: 'display_result',
        params: {
          message: "I've analyzed your knowledge graph. Here are your learning opportunities:\n\n${previous.gaps}\n\nWould you like me to create a learning path?",
          format: 'list'
        },
        description: 'Present knowledge gaps'
      }
    ],
    
    behavior: {
      trigger: 'manual',
      requiresConfirmation: false,
      showProgress: true,
      notifyOnComplete: true,
      maxExecutionTime: 25000,
      retryOnFailure: true,
      retryCount: 2,
      interactive: true
    },
    
    onboarding: {
      welcomeMessage: "I'm your Knowledge Gap Finder! I'll help you see what you should learn next.",
      steps: [
        "I'll analyze your knowledge graph",
        "I'll find concepts with low mastery",
        "I'll identify missing prerequisites",
        "I'll suggest a prioritized learning path"
      ],
      example: "If you've mastered 'flexbox' but never learned 'CSS grid', I'll notice that gap and suggest grid as your next topic.",
      tips: [
        "Run me monthly to track your learning journey",
        "Focus on one gap at a time for steady progress",
        "I learn from your struggle patterns too"
      ]
    },
    
    customization: {
      canModifyActions: true,
      canAddActions: true,
      canChangeTrigger: true,
      availableParams: ['focusArea', 'maxGaps', 'includePrerequisites']
    }
  },

  // ============================================
  // CUSTOM AGENT - Blank slate for advanced users
  // ============================================
  
  custom_agent: {
    id: 'custom_agent',
    name: 'Custom Agent',
    description: 'Start from scratch and build your own agent. Choose actions, define behavior, and create something unique.',
    difficulty: 'advanced',
    timeToDeploy: '10+ minutes',
    
    purpose: 'Create a completely custom agent for your specific needs',
    
    actions: [], // Empty - user defines
    
    behavior: {
      trigger: 'manual',
      requiresConfirmation: false,
      showProgress: true,
      notifyOnComplete: true,
      maxExecutionTime: 60000,
      retryOnFailure: true,
      retryCount: 3,
      custom: true
    },
    
    onboarding: {
      welcomeMessage: "Let's build your own agent from scratch! I'll guide you through it.",
      steps: [
        "Choose what your agent should do",
        "Pick actions from the available palette",
        "Configure how your agent behaves",
        "Test and deploy your agent"
      ],
      example: "Want an agent that reads your notes every morning and emails you a summary? You can build that here.",
      tips: [
        "Start simple - add more actions later",
        "Test your agent with small datasets first",
        "Share your custom agents with the community"
      ]
    },
    
    customization: {
      canModifyActions: true,
      canAddActions: true,
      canChangeTrigger: true,
      availableParams: ['all']
    }
  }
};

/**
 * Get template by ID
 */
export function getTemplate(templateId) {
  return AGENT_TEMPLATES[templateId] || null;
}

/**
 * Get all templates
 */
export function getAllTemplates() {
  return Object.values(AGENT_TEMPLATES);
}

/**
 * Get templates by difficulty
 */
export function getTemplatesByDifficulty(difficulty) {
  return Object.values(AGENT_TEMPLATES).filter(t => t.difficulty === difficulty);
}

/**
 * Get beginner-friendly templates (for first-time users)
 */
export function getBeginnerTemplates() {
  return Object.values(AGENT_TEMPLATES).filter(t => t.difficulty === 'beginner');
}

/**
 * Create a custom agent from template
 */
export function createFromTemplate(templateId, customizations = {}) {
  const template = AGENT_TEMPLATES[templateId];
  if (!template) {
    return null;
  }
  
  // Deep clone the template
  const agent = JSON.parse(JSON.stringify(template));
  
  // Apply customizations
  if (customizations.name) agent.name = customizations.name;
  if (customizations.actions) agent.actions = customizations.actions;
  if (customizations.behavior) {
    agent.behavior = { ...agent.behavior, ...customizations.behavior };
  }
  
  // Generate unique ID
  agent.id = `custom_${templateId}_${Date.now()}`;
  agent.createdAt = Date.now();
  agent.modifiedAt = Date.now();
  agent.isCustom = true;
  agent.baseTemplate = templateId;
  
  return agent;
}

/**
 * Validate a template configuration
 */
export function validateTemplate(template) {
  const errors = [];
  
  if (!template.name || template.name.trim() === '') {
    errors.push('Agent name is required');
  }
  
  if (!template.actions || !Array.isArray(template.actions)) {
    errors.push('Agent must have at least one action');
  } else {
    for (let i = 0; i < template.actions.length; i++) {
      const action = template.actions[i];
      if (!action.actionId) {
        errors.push(`Action ${i + 1} missing actionId`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export default { 
  AGENT_TEMPLATES, 
  getTemplate, 
  getAllTemplates, 
  getTemplatesByDifficulty,
  getBeginnerTemplates,
  createFromTemplate,
  validateTemplate
};
