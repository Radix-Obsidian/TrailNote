/**
 * Codecademy Concept Taxonomy
 * Maps Codecademy learning paths to concept IDs for the pedagogical engine.
 * Used by concept-graph.js when platform === 'codecademy'.
 */

export const CODECADEMY_CONCEPTS = {
  // Web Development Path
  'cc-html-fundamentals': {
    id: 'cc-html-fundamentals',
    name: 'HTML Fundamentals',
    description: 'Elements, structure, semantic HTML',
    tags: ['html', 'fundamentals'],
    prerequisites: [],
    difficulty: 1
  },
  'cc-css-fundamentals': {
    id: 'cc-css-fundamentals',
    name: 'CSS Fundamentals',
    description: 'Selectors, visual rules, box model',
    tags: ['css', 'fundamentals'],
    prerequisites: ['cc-html-fundamentals'],
    difficulty: 1
  },
  'cc-js-intro': {
    id: 'cc-js-intro',
    name: 'Introduction to JavaScript',
    description: 'Variables, conditionals, functions',
    tags: ['javascript', 'intro'],
    prerequisites: [],
    difficulty: 2
  },
  'cc-js-arrays-loops': {
    id: 'cc-js-arrays-loops',
    name: 'Arrays & Loops',
    description: 'Array methods, for/while loops, iterators',
    tags: ['javascript', 'arrays', 'loops'],
    prerequisites: ['cc-js-intro'],
    difficulty: 2
  },
  'cc-js-objects': {
    id: 'cc-js-objects',
    name: 'Objects & Classes',
    description: 'Object literals, this keyword, class syntax',
    tags: ['javascript', 'objects', 'classes'],
    prerequisites: ['cc-js-arrays-loops'],
    difficulty: 3
  },
  'cc-react': {
    id: 'cc-react',
    name: 'Learn React',
    description: 'JSX, components, props, state, hooks',
    tags: ['react', 'javascript', 'frontend'],
    prerequisites: ['cc-js-objects'],
    difficulty: 3
  },
  // Python Path
  'cc-python-intro': {
    id: 'cc-python-intro',
    name: 'Learn Python 3',
    description: 'Syntax, variables, control flow, functions',
    tags: ['python', 'intro'],
    prerequisites: [],
    difficulty: 1
  },
  'cc-python-intermediate': {
    id: 'cc-python-intermediate',
    name: 'Intermediate Python',
    description: 'Classes, modules, file I/O, exceptions',
    tags: ['python', 'intermediate'],
    prerequisites: ['cc-python-intro'],
    difficulty: 2
  },
  // SQL Path
  'cc-sql-basics': {
    id: 'cc-sql-basics',
    name: 'Learn SQL',
    description: 'SELECT, WHERE, JOIN, aggregate functions',
    tags: ['sql', 'databases'],
    prerequisites: [],
    difficulty: 2
  },
  // Command Line & Git
  'cc-command-line': {
    id: 'cc-command-line',
    name: 'Command Line',
    description: 'Navigation, manipulation, environment',
    tags: ['command-line', 'terminal'],
    prerequisites: [],
    difficulty: 1
  },
  'cc-git': {
    id: 'cc-git',
    name: 'Learn Git',
    description: 'Init, add, commit, branch, merge',
    tags: ['git', 'version-control'],
    prerequisites: ['cc-command-line'],
    difficulty: 2
  }
};

export default CODECADEMY_CONCEPTS;
