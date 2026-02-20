/**
 * LeetCode Concept Taxonomy
 * Maps LeetCode problem categories to concept IDs for the pedagogical engine.
 * Used by concept-graph.js when platform === 'leetcode'.
 */

export const LEETCODE_CONCEPTS = {
  'lc-arrays-strings': {
    id: 'lc-arrays-strings',
    name: 'Arrays & Strings',
    description: 'Two pointers, sliding window, prefix sums',
    tags: ['arrays', 'strings', 'fundamentals'],
    prerequisites: [],
    difficulty: 1
  },
  'lc-hash-maps': {
    id: 'lc-hash-maps',
    name: 'Hash Maps & Sets',
    description: 'Frequency counting, grouping, lookup optimization',
    tags: ['hash-map', 'set', 'lookup'],
    prerequisites: ['lc-arrays-strings'],
    difficulty: 2
  },
  'lc-linked-lists': {
    id: 'lc-linked-lists',
    name: 'Linked Lists',
    description: 'Traversal, reversal, fast/slow pointers, merge',
    tags: ['linked-list', 'pointers'],
    prerequisites: ['lc-arrays-strings'],
    difficulty: 2
  },
  'lc-stacks-queues': {
    id: 'lc-stacks-queues',
    name: 'Stacks & Queues',
    description: 'Monotonic stacks, BFS with queues, balanced parentheses',
    tags: ['stack', 'queue'],
    prerequisites: ['lc-arrays-strings'],
    difficulty: 2
  },
  'lc-trees': {
    id: 'lc-trees',
    name: 'Binary Trees',
    description: 'DFS, BFS, traversal orders, path problems',
    tags: ['tree', 'binary-tree', 'dfs', 'bfs'],
    prerequisites: ['lc-stacks-queues'],
    difficulty: 3
  },
  'lc-bst': {
    id: 'lc-bst',
    name: 'Binary Search Trees',
    description: 'Search, insert, delete, validation, balancing',
    tags: ['bst', 'binary-search'],
    prerequisites: ['lc-trees'],
    difficulty: 3
  },
  'lc-graphs': {
    id: 'lc-graphs',
    name: 'Graphs',
    description: 'DFS, BFS, topological sort, union-find, shortest path',
    tags: ['graph', 'dfs', 'bfs', 'topological-sort'],
    prerequisites: ['lc-trees'],
    difficulty: 4
  },
  'lc-dynamic-programming': {
    id: 'lc-dynamic-programming',
    name: 'Dynamic Programming',
    description: 'Memoization, tabulation, state transitions',
    tags: ['dp', 'memoization', 'optimization'],
    prerequisites: ['lc-arrays-strings'],
    difficulty: 4
  },
  'lc-binary-search': {
    id: 'lc-binary-search',
    name: 'Binary Search',
    description: 'Search space reduction, boundary finding',
    tags: ['binary-search', 'search'],
    prerequisites: ['lc-arrays-strings'],
    difficulty: 2
  },
  'lc-sorting': {
    id: 'lc-sorting',
    name: 'Sorting & Searching',
    description: 'Merge sort, quick sort, custom comparators',
    tags: ['sorting', 'searching'],
    prerequisites: ['lc-arrays-strings'],
    difficulty: 2
  },
  'lc-backtracking': {
    id: 'lc-backtracking',
    name: 'Backtracking',
    description: 'Permutations, combinations, constraint satisfaction',
    tags: ['backtracking', 'recursion'],
    prerequisites: ['lc-trees'],
    difficulty: 4
  },
  'lc-greedy': {
    id: 'lc-greedy',
    name: 'Greedy Algorithms',
    description: 'Interval scheduling, activity selection, optimal choices',
    tags: ['greedy', 'optimization'],
    prerequisites: ['lc-sorting'],
    difficulty: 3
  }
};

export default LEETCODE_CONCEPTS;
