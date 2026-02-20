/**
 * freeCodeCamp Concept Taxonomy
 * Maps FCC curriculum paths to concept IDs for the pedagogical engine.
 * Used by concept-graph.js when platform === 'freecodecamp'.
 */

export const FCC_CONCEPTS = {
  // Responsive Web Design
  'html-structure': {
    id: 'html-structure',
    name: 'HTML Document Structure',
    description: 'DOCTYPE, html, head, body elements',
    tags: ['html', 'structure', 'basics'],
    prerequisites: [],
    difficulty: 1
  },
  'html-elements': {
    id: 'html-elements',
    name: 'HTML Elements & Tags',
    description: 'Headings, paragraphs, lists, links, images',
    tags: ['html', 'elements', 'tags'],
    prerequisites: ['html-structure'],
    difficulty: 1
  },
  'html-forms': {
    id: 'html-forms',
    name: 'HTML Forms',
    description: 'Form elements, inputs, labels, buttons',
    tags: ['html', 'forms', 'inputs'],
    prerequisites: ['html-elements'],
    difficulty: 2
  },
  'css-basics': {
    id: 'css-basics',
    name: 'CSS Basics',
    description: 'Selectors, properties, values, colors',
    tags: ['css', 'basics', 'selectors'],
    prerequisites: ['html-elements'],
    difficulty: 1
  },
  'css-box-model': {
    id: 'css-box-model',
    name: 'CSS Box Model',
    description: 'Margin, padding, border, width, height',
    tags: ['css', 'box-model', 'layout'],
    prerequisites: ['css-basics'],
    difficulty: 2
  },
  'css-flexbox': {
    id: 'css-flexbox',
    name: 'CSS Flexbox',
    description: 'Flex container, direction, wrap, justify, align',
    tags: ['css', 'flexbox', 'layout'],
    prerequisites: ['css-box-model'],
    difficulty: 3
  },
  'css-grid': {
    id: 'css-grid',
    name: 'CSS Grid',
    description: 'Grid container, rows, columns, areas, gaps',
    tags: ['css', 'grid', 'layout'],
    prerequisites: ['css-box-model'],
    difficulty: 3
  },
  'css-responsive': {
    id: 'css-responsive',
    name: 'Responsive Design',
    description: 'Media queries, viewport, mobile-first',
    tags: ['css', 'responsive', 'media-queries'],
    prerequisites: ['css-flexbox', 'css-grid'],
    difficulty: 3
  },
  // JavaScript
  'js-basics': {
    id: 'js-basics',
    name: 'JavaScript Basics',
    description: 'Variables, data types, operators',
    tags: ['javascript', 'basics', 'variables'],
    prerequisites: [],
    difficulty: 2
  },
  'js-functions': {
    id: 'js-functions',
    name: 'JavaScript Functions',
    description: 'Function declarations, parameters, return values',
    tags: ['javascript', 'functions'],
    prerequisites: ['js-basics'],
    difficulty: 2
  },
  'js-arrays': {
    id: 'js-arrays',
    name: 'Arrays & Iteration',
    description: 'Array methods, loops, iteration',
    tags: ['javascript', 'arrays', 'loops'],
    prerequisites: ['js-functions'],
    difficulty: 3
  },
  'js-objects': {
    id: 'js-objects',
    name: 'JavaScript Objects',
    description: 'Object literals, properties, methods',
    tags: ['javascript', 'objects'],
    prerequisites: ['js-functions'],
    difficulty: 3
  },
  'js-dom': {
    id: 'js-dom',
    name: 'DOM Manipulation',
    description: 'Selecting elements, events, dynamic content',
    tags: ['javascript', 'dom', 'events'],
    prerequisites: ['js-objects', 'html-elements'],
    difficulty: 4
  },
  'js-async': {
    id: 'js-async',
    name: 'Async JavaScript',
    description: 'Promises, async/await, fetch API',
    tags: ['javascript', 'async', 'promises'],
    prerequisites: ['js-functions'],
    difficulty: 4
  }
};

export default FCC_CONCEPTS;
