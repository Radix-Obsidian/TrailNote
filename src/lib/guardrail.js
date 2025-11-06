// HintHopper Guardrail System
// Non-spoiler compliance engine

import { conceptGraph } from './concept-graph.js';

// Schema for valid response structure
const VALID_RESPONSE_SCHEMA = {
  required: ['diagnosis', 'why_it_happens', 'steps', 'self_check'],
  optional: ['concept_key', 'redacted_code_glimpse', 'version'],
  maxStepLength: 120,
  maxSteps: 5,
  maxDiagnosisLength: 150,
  maxSelfCheckLength: 120
};

// Rules for what makes a response spoilery
const SPOILER_RULES = {
  // Detects complete code solutions
  completeSolution: (response, context) => {
    const userCodeLines = (context.userCode || '').split('\n').length;
    
    // Look for code blocks that look like full solutions
    const codeBlocks = getAllCodeBlocks(response);
    
    for (const block of codeBlocks) {
      // If code block is more than 70% of the user's code length, it's likely a solution
      if (block.split('\n').length > userCodeLines * 0.7) {
        return {
          passed: false,
          reason: 'Response contains what appears to be a complete code solution'
        };
      }
    }
    
    return { passed: true };
  },
  
  // Detects "just do X" direct answers
  directAnswer: (response) => {
    const directPatterns = [
      /just\s+(add|use|write|put|include|insert)\s+[`'"<][^`'"<>]{5,}[`'">]/i,
      /the\s+(answer|solution|code)\s+is\s+[`'"<][^`'"<>]{5,}[`'">]/i,
      /you\s+(need|should)\s+(to\s+)?(just|only)\s+[`'"<][^`'"<>]{5,}[`'">]/i
    ];
    
    for (const pattern of directPatterns) {
      if (pattern.test(JSON.stringify(response))) {
        return {
          passed: false,
          reason: 'Response gives direct "just do X" answers without explanation'
        };
      }
    }
    
    return { passed: true };
  },
  
  // Detects missing required fields
  schemaCompliance: (response) => {
    for (const field of VALID_RESPONSE_SCHEMA.required) {
      if (!response[field]) {
        return {
          passed: false, 
          reason: `Missing required field: ${field}`
        };
      }
    }
    
    // Check field lengths
    if (response.diagnosis && response.diagnosis.length > VALID_RESPONSE_SCHEMA.maxDiagnosisLength) {
      return {
        passed: false,
        reason: `Diagnosis too long (${response.diagnosis.length} chars, max ${VALID_RESPONSE_SCHEMA.maxDiagnosisLength})`
      };
    }
    
    if (response.self_check && response.self_check.length > VALID_RESPONSE_SCHEMA.maxSelfCheckLength) {
      return {
        passed: false,
        reason: `Self-check too long (${response.self_check.length} chars, max ${VALID_RESPONSE_SCHEMA.maxSelfCheckLength})`
      };
    }
    
    // Check steps
    if (!Array.isArray(response.steps)) {
      return {
        passed: false,
        reason: 'Steps must be an array'
      };
    }
    
    if (response.steps.length > VALID_RESPONSE_SCHEMA.maxSteps) {
      return {
        passed: false,
        reason: `Too many steps (${response.steps.length}, max ${VALID_RESPONSE_SCHEMA.maxSteps})`
      };
    }
    
    for (const step of response.steps) {
      if (typeof step !== 'string') {
        return {
          passed: false,
          reason: 'Each step must be a string'
        };
      }
      
      if (step.length > VALID_RESPONSE_SCHEMA.maxStepLength) {
        return {
          passed: false,
          reason: `Step too long (${step.length} chars, max ${VALID_RESPONSE_SCHEMA.maxStepLength})`
        };
      }
    }
    
    return { passed: true };
  },
  
  // Check for concept key validity if provided
  conceptKeyValidity: async (response) => {
    if (!response.concept_key) return { passed: true };
    
    // Verify concept key exists in graph
    const concept = await conceptGraph.getConcept(response.concept_key);
    if (!concept) {
      return {
        passed: false,
        reason: `Invalid concept_key: ${response.concept_key}`
      };
    }
    
    return { passed: true };
  }
};

// Helper function to extract all code blocks from a response object
function getAllCodeBlocks(response) {
  const text = JSON.stringify(response);
  const codeBlocks = [];
  
  // Find anything between backticks that looks like code
  const backtickMatches = text.match(/`{1,3}([\s\S]+?)`{1,3}/g) || [];
  for (const match of backtickMatches) {
    codeBlocks.push(match.replace(/`{1,3}/g, '').trim());
  }
  
  // Also find HTML-like code
  const htmlMatches = text.match(/<[a-z][^>]*>[\s\S]*?<\/[a-z][^>]*>/g) || [];
  for (const match of htmlMatches) {
    codeBlocks.push(match.trim());
  }
  
  return codeBlocks;
}

// Main guardrail interface
export const guardrail = {
  /**
   * Extract rules based on test patterns for more accurate hint guardrails
   * @param {Object} context - The challenge context
   * @return {Array} Array of rule objects that apply to this context
   */
  _getTestRules(context) {
    if (!context || !context.tests || !context.tests.length) {
      return [];
    }
    
    const rules = [];
    const testsText = context.tests.join(' ').toLowerCase();
    
    // ========== HTML Element Tests ==========
    const htmlElements = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'img', 'ul', 'ol', 'li', 
                         'form', 'input', 'button', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'article', 'section', 
                         'header', 'footer', 'nav', 'main', 'aside'];
    
    // Check for specific HTML element requirements
    for (const element of htmlElements) {
      // Look for patterns that indicate element requirements
      if (testsText.includes(`<${element}`) || 
          testsText.includes(`</${element}>`) || 
          testsText.includes(`${element} element`) || 
          testsText.includes(`${element} tag`)) {
        
        rules.push({
          type: 'html_element',
          element,
          severity: 'medium',
          description: `Hints should reference ${element} element but not provide complete solution`
        });
      }
    }
    
    // ========== Attribute Tests ==========
    const commonAttributes = ['id', 'class', 'style', 'src', 'href', 'alt', 'title', 'type', 'value', 'name', 'placeholder'];
    
    for (const attr of commonAttributes) {
      // Look for patterns indicating attribute requirements
      if (testsText.includes(`${attr}="`) || 
          testsText.includes(`${attr} attribute`) || 
          testsText.includes(`${attr}=`) || 
          testsText.includes(`has ${attr}`)) {
        
        rules.push({
          type: 'attribute',
          attribute: attr,
          severity: 'high',
          description: `Hints about ${attr} attribute should not show exact values`
        });
      }
    }
    
    // ========== CSS Property Tests ==========
    const cssProperties = ['color', 'background', 'margin', 'padding', 'border', 'font-size', 'font-weight', 
                          'display', 'position', 'width', 'height', 'flex'];
    
    for (const prop of cssProperties) {
      // Look for patterns indicating CSS requirements
      if (testsText.includes(`${prop}:`) || 
          testsText.includes(`${prop} property`) || 
          testsText.includes(`css ${prop}`)) {
        
        rules.push({
          type: 'css_property',
          property: prop,
          severity: 'medium',
          description: `Hints about ${prop} CSS property should avoid exact values`
        });
      }
    }
    
    // ========== Function Tests ==========
    // Check for function-related tests
    const functionWords = ['function', 'method', 'callback', 'return', 'parameter', 'argument'];
    
    for (const word of functionWords) {
      if (testsText.includes(word)) {
        rules.push({
          type: 'function',
          severity: 'high',
          description: 'Hints about functions should suggest approaches but not provide implementations'
        });
        break; // Only add this rule once
      }
    }
    
    // ========== Challenge-specific special cases ==========
    // These are based on common challenge patterns
    
    // 1. Nested element requirements
    for (const test of context.tests) {
      // Look for nesting patterns like "X inside Y" or "X within Y"
      const nestedMatch = test.match(/([\w-]+)\s+(inside|within|in)\s+([\w-]+)/i);
      if (nestedMatch) {
        const innerElement = nestedMatch[1];
        const outerElement = nestedMatch[3];
        
        rules.push({
          type: 'nesting',
          innerElement,
          outerElement,
          severity: 'high',
          description: `Hints should explain the relationship between ${innerElement} and ${outerElement} without giving code`
        });
      }
    }
    
    // 2. Text content requirements
    for (const test of context.tests) {
      // Check for text requirements using quotes
      const textMatches = test.match(/["']([^"']+)["']/g);
      if (textMatches && textMatches.length > 0) {
        // Extract quoted strings as required text
        const requiredTexts = textMatches.map(m => m.slice(1, -1));
        
        rules.push({
          type: 'text_content',
          requiredTexts,
          severity: 'critical',
          description: 'Hints should not provide complete text content required by tests'
        });
      }
    }
    
    return rules;
  },
  
  /**
   * Validate LLM response against guardrails
   * @param {Object} response - The LLM response to validate
   * @param {Object} context - The context object used to generate the response
   * @return {Object} Validation result with pass/fail and reasons
   */
  async validateResponse(response, context) {
    // Convert string to JSON if needed
    let parsedResponse = response;
    if (typeof response === 'string') {
      try {
        parsedResponse = JSON.parse(response);
      } catch (e) {
        return {
          passed: false,
          reason: 'Response is not valid JSON',
          details: this._getTestRules(context)
        };
      }
    }
    
    // Run all rules
    const results = [];
    
    // Run synchronous rules
    for (const [ruleName, ruleFunc] of Object.entries(SPOILER_RULES)) {
      if (ruleName !== 'conceptKeyValidity') {  // Skip async rule for now
        const result = ruleFunc(parsedResponse, context);
        results.push({
          rule: ruleName,
          passed: result.passed,
          reason: result.reason || null
        });
      }
    }
    
    // Run async rule
    const conceptResult = await SPOILER_RULES.conceptKeyValidity(parsedResponse);
    results.push({
      rule: 'conceptKeyValidity',
      passed: conceptResult.passed,
      reason: conceptResult.reason || null
    });
    
    // Calculate overall result
    const failedRules = results.filter(r => !r.passed);
    const passed = failedRules.length === 0;
    
    return {
      passed,
      reason: passed ? null : 'Failed guardrail validation',
      details: results
    };
  },
  
  /**
   * Sanitize a response to ensure it doesn't contain spoilers
   * @param {Object} response - The LLM response to sanitize
   * @param {Object} context - The context object used to generate the response
   * @return {Object} Sanitized response
   */
  async sanitizeResponse(response, context) {
    // Convert string to JSON if needed
    let parsedResponse = response;
    if (typeof response === 'string') {
      try {
        parsedResponse = JSON.parse(response);
      } catch (e) {
        // If can't parse, return a fallback response
        return this.createFallbackResponse(context);
      }
    }
    
    // Generate concept key if missing
    if (!parsedResponse.concept_key && context && (context.tests || context.failingTests)) {
      const testText = (context.tests || context.failingTests)[0] || '';
      const conceptId = await conceptGraph.findConceptFromText(testText);
      if (conceptId) {
        parsedResponse.concept_key = conceptId;
      }
    }
    
    // Add version if missing
    if (!parsedResponse.version) {
      parsedResponse.version = '1.0';
    }
    
    // Check if this needs to be sanitized
    const validation = await this.validateResponse(parsedResponse, context);
    
    if (validation.passed) {
      return parsedResponse;
    }
    
    // Sanitize the response
    const sanitized = { ...parsedResponse };
    
    // Fix schema issues
    for (const field of VALID_RESPONSE_SCHEMA.required) {
      if (!sanitized[field]) {
        if (field === 'steps' && !Array.isArray(sanitized.steps)) {
          sanitized.steps = ['Review the test requirements carefully', 'Check your HTML syntax'];
        } else {
          sanitized[field] = this.createFallbackResponse(context)[field];
        }
      }
    }
    
    // Truncate any fields that are too long
    if (sanitized.diagnosis && sanitized.diagnosis.length > VALID_RESPONSE_SCHEMA.maxDiagnosisLength) {
      sanitized.diagnosis = sanitized.diagnosis.substring(0, VALID_RESPONSE_SCHEMA.maxDiagnosisLength - 3) + '...';
    }
    
    if (sanitized.self_check && sanitized.self_check.length > VALID_RESPONSE_SCHEMA.maxSelfCheckLength) {
      sanitized.self_check = sanitized.self_check.substring(0, VALID_RESPONSE_SCHEMA.maxSelfCheckLength - 3) + '...';
    }
    
    // Limit number of steps
    if (Array.isArray(sanitized.steps) && sanitized.steps.length > VALID_RESPONSE_SCHEMA.maxSteps) {
      sanitized.steps = sanitized.steps.slice(0, VALID_RESPONSE_SCHEMA.maxSteps);
    }
    
    // Truncate step lengths
    if (Array.isArray(sanitized.steps)) {
      sanitized.steps = sanitized.steps.map(step => {
        if (step.length > VALID_RESPONSE_SCHEMA.maxStepLength) {
          return step.substring(0, VALID_RESPONSE_SCHEMA.maxStepLength - 3) + '...';
        }
        return step;
      });
    }
    
    // Redact any code blocks in redacted_code_glimpse
    if (sanitized.redacted_code_glimpse) {
      const codeBlocks = getAllCodeBlocks({ redacted_code_glimpse: sanitized.redacted_code_glimpse });
      if (codeBlocks.length > 0) {
        for (const block of codeBlocks) {
          // Replace code with a placeholder if it looks like a solution
          if (block.length > 30) {
            sanitized.redacted_code_glimpse = sanitized.redacted_code_glimpse.replace(block, '[code hint redacted for learning purposes]');
          }
        }
      }
    }
    
    return sanitized;
  },
  
  /**
   * Create a fallback response when LLM response is invalid
   * @param {Object} context - The context object
   * @return {Object} A fallback response
   */
  createFallbackResponse(context) {
    return {
      diagnosis: "There may be a syntax or structure issue in your code",
      why_it_happens: "HTML and CSS are strict about syntax and structure. Missing closing tags or incorrect nesting can break your page.",
      steps: [
        "Check for any unclosed HTML tags",
        "Make sure elements are properly nested",
        "Verify that attributes have correct values in quotes"
      ],
      self_check: "Does each opening tag have a corresponding closing tag? Are your elements properly nested?",
      concept_key: "html-structure",
      version: "1.0"
    };
  }
};

export default guardrail;
