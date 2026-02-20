/**
 * Udemy Concept Taxonomy
 * Maps common Udemy course topics to concept IDs for the pedagogical engine.
 * Used by concept-graph.js when platform === 'udemy'.
 */

export const UDEMY_CONCEPTS = {
  // Web Development (most popular Udemy category)
  'web-html-css': {
    id: 'web-html-css',
    name: 'HTML & CSS Fundamentals',
    description: 'Building web pages with HTML structure and CSS styling',
    tags: ['html', 'css', 'web'],
    prerequisites: [],
    difficulty: 1
  },
  'web-javascript': {
    id: 'web-javascript',
    name: 'JavaScript for Web',
    description: 'DOM manipulation, events, ES6+ features',
    tags: ['javascript', 'web', 'es6'],
    prerequisites: ['web-html-css'],
    difficulty: 2
  },
  'web-react': {
    id: 'web-react',
    name: 'React',
    description: 'Components, state, hooks, JSX, React Router',
    tags: ['react', 'javascript', 'frontend'],
    prerequisites: ['web-javascript'],
    difficulty: 3
  },
  'web-node': {
    id: 'web-node',
    name: 'Node.js & Express',
    description: 'Server-side JavaScript, REST APIs, middleware',
    tags: ['node', 'express', 'backend'],
    prerequisites: ['web-javascript'],
    difficulty: 3
  },
  'web-fullstack': {
    id: 'web-fullstack',
    name: 'Full-Stack Development',
    description: 'MERN/MEAN stack, deployment, databases',
    tags: ['fullstack', 'mern', 'deployment'],
    prerequisites: ['web-react', 'web-node'],
    difficulty: 4
  },
  // Python
  'python-basics': {
    id: 'python-basics',
    name: 'Python Fundamentals',
    description: 'Variables, data types, control flow, functions',
    tags: ['python', 'basics'],
    prerequisites: [],
    difficulty: 1
  },
  'python-oop': {
    id: 'python-oop',
    name: 'Python OOP',
    description: 'Classes, inheritance, polymorphism, encapsulation',
    tags: ['python', 'oop', 'classes'],
    prerequisites: ['python-basics'],
    difficulty: 2
  },
  'python-data': {
    id: 'python-data',
    name: 'Data Science with Python',
    description: 'Pandas, NumPy, data visualization, analysis',
    tags: ['python', 'data-science', 'pandas'],
    prerequisites: ['python-basics'],
    difficulty: 3
  },
  'python-ml': {
    id: 'python-ml',
    name: 'Machine Learning',
    description: 'Scikit-learn, neural networks, model training',
    tags: ['python', 'machine-learning', 'ai'],
    prerequisites: ['python-data'],
    difficulty: 4
  },
  // Mobile
  'mobile-flutter': {
    id: 'mobile-flutter',
    name: 'Flutter & Dart',
    description: 'Cross-platform mobile development with Flutter',
    tags: ['flutter', 'dart', 'mobile'],
    prerequisites: [],
    difficulty: 3
  },
  'mobile-react-native': {
    id: 'mobile-react-native',
    name: 'React Native',
    description: 'Mobile apps with JavaScript and React Native',
    tags: ['react-native', 'mobile', 'javascript'],
    prerequisites: ['web-react'],
    difficulty: 3
  }
};

export default UDEMY_CONCEPTS;
