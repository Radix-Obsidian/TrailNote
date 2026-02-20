// Tutor caller with guardrails for TrailNote
// OpenAI integration with hint-only system prompts

import { store } from "./storage.js";
import { tokens } from "./tokens.js";
import { bktEngine } from "./bkt-engine.js";
import { pedagogicalEngine } from "./pedagogical-engine.js";

// Import modules dynamically for browser environment
let guardrailSystem;
let outcomeTracker;
let abTesting;

if (typeof window !== 'undefined') {
  // Import guardrail system
  import('./guardrail.js').then(module => {
    guardrailSystem = module.default;
    console.log('[HintHopper] Guardrail system loaded');
  }).catch(err => {
    console.error('[HintHopper] Failed to load guardrail system:', err);
  });
  
  // Import outcome tracker
  import('./outcome-tracker.js').then(module => {
    outcomeTracker = module.default;
    console.log('[HintHopper] Outcome tracker loaded');
  }).catch(err => {
    console.error('[HintHopper] Failed to load outcome tracker:', err);
  });
  
  // Import A/B testing framework
  import('./ab-testing.js').then(module => {
    abTesting = module.default;
    console.log('[HintHopper] A/B testing framework loaded');
  }).catch(err => {
    console.error('[HintHopper] Failed to load A/B testing framework:', err);
  });
}

// Import Intelligence Hub
let intelligenceHub;
if (typeof window !== 'undefined') {
  import('./intelligence-hub.js').then(module => {
    intelligenceHub = module.hub;
    console.log('[HintHopper] Intelligence Hub loaded');
  }).catch(err => {
    console.warn('[HintHopper] Intelligence Hub not loaded (non-critical):', err);
  });
}

const DEFAULT_MODEL = "gpt-4o-mini";
const SUPPORTED_MODELS = new Set([
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
  "o4-mini",
  "o4"
]);

const GROQ_MODELS = new Set([
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b"
]);

const IGNORABLE_RUNTIME_ERRORS = /(Extension context invalidated|Receiving end does not exist)/i;

const SYS_BASE = `
You are Bunji, an energetic and friendly coding tutor for TrailNote, helping learners "hop to the right idea".
{PLATFORM_CONTEXT}
Rules:
- Hints, not solutions. Never output full task code.
- Keep responses short and structured.
- Use the JSON schema provided. Do not include any extra keys or commentary.
- If the user asks for the full answer, refuse and offer steps instead.
`;

const MODE_TONE = {
  nudge: "Keep it brief and action-oriented.",
  study: "Include a 2-3 bullet mini-lesson connecting the concept to HTML semantics.",
  exam: "Only ask questions that lead the learner; no direct statements."
};

const SCHEMA = `
Return JSON with these fields:
{
  "diagnosis": "1-2 sentences describing the likely issue in plain English.",
  "why_it_happens": "A brief concept link (e.g., 'an anchor must be inside the first <p>').",
  "steps": ["short actionable step 1", "short step 2", "short step 3 (optional)"],
  "self_check": "One question the learner can answer to verify the fix.",
  "redacted_code_glimpse": "At most 1 short snippet name-only, e.g., '<p> ... </p>' or 'anchor inside first paragraph' — no full code."
}
`;

function sanitizeStrict(text, strict) {
  if (!strict || typeof text !== "string") return text;
  let cleaned = text.replace(/```[\s\S]*?```/g, "[code omitted]");
  cleaned = cleaned.replace(/`[^`]{60,}`/g, "[snippet omitted]");
  if (cleaned.length > 1200) cleaned = cleaned.slice(0, 1200);
  return cleaned;
}

async function sanitizeStructuredResponse(obj, strict, context) {
  if (!obj || typeof obj !== "object") return obj;
  
  // Use the guardrail system if available, otherwise fall back to simple sanitization
  if (guardrailSystem) {
    try {
      return await guardrailSystem.sanitizeResponse(obj, context);
    } catch (error) {
      console.warn('[HintHopper] Guardrail system error:', error);
      // Fall back to simple sanitization if guardrail fails
    }
  }
  
  // Simple sanitization as fallback
  const clone = { ...obj };
  if (Array.isArray(clone.steps)) {
    clone.steps = clone.steps.map(step => sanitizeStrict(step, strict));
  }
  clone.diagnosis = sanitizeStrict(clone.diagnosis, strict);
  clone.why_it_happens = sanitizeStrict(clone.why_it_happens, strict);
  clone.self_check = sanitizeStrict(clone.self_check, strict);
  clone.redacted_code_glimpse = sanitizeStrict(clone.redacted_code_glimpse, strict);
  return clone;
}

function buildSystemPrompt(tone, bktDirective, misconceptionHint, platformAddition) {
  const toneKey = MODE_TONE[tone] ? tone : "nudge";
  const platformCtx = platformAddition || 'The learner is studying on an online coding platform.';
  let prompt = SYS_BASE.replace('{PLATFORM_CONTEXT}', platformCtx);
  prompt += `\nTone: ${MODE_TONE[toneKey]}`;
  if (bktDirective) prompt += `\n${bktDirective}`;
  if (misconceptionHint) prompt += `\n${misconceptionHint}`;
  return prompt;
}

function makeUserPrompt(mode, context, ruleHints, toneSetting) {
  const { userQuery, enhancedQuery, userCode, tests, failingTests } = context;
  
  // Use enhanced query if available, otherwise fall back to original query
  const queryToUse = enhancedQuery || userQuery;
  
  const codeSection = userCode ? `\n\nMY CODE:\n\`\`\`\n${userCode}\n\`\`\`` : "";
  const testSection = tests ? `\n\nTEST REQUIREMENTS:\n\`\`\`\n${tests.join('\n')}\n\`\`\`` : "";
  const failingTestSection = failingTests ? `\n\nFAILING TESTS:\n\`\`\`\n${failingTests.join('\n')}\n\`\`\`` : "";
  
  let userPrompt = `${queryToUse}${codeSection}${testSection}${failingTestSection}`;
  if (ruleHints) {
    userPrompt += `\n\nPlease follow these guidelines: ${ruleHints}`;
  }
  
  return userPrompt;
}

function ensureStepsArray(value) {
  if (Array.isArray(value)) {
    return value.map(v => typeof v === "string" ? v : String(v ?? ""));
  }
  if (!value) return [];
  return [typeof value === "string" ? value : String(value)];
}

function parseTutorJson(raw, toolCalls) {
  const makeFallback = (reason) => ({
    diagnosis: `I couldn't parse the tutor response${reason ? ` (${reason}).` : '.'}`,
    why_it_happens: "Model returned plain text.",
    steps: ["Try again"],
    self_check: "Do you see an anchor inside the first paragraph?",
    redacted_code_glimpse: ""
  });

  const defaultShape = makeFallback("");

  const tryParse = (text) => {
    const parsed = JSON.parse(text);
    return {
      diagnosis: parsed.diagnosis ?? defaultShape.diagnosis,
      why_it_happens: parsed.why_it_happens ?? defaultShape.why_it_happens,
      steps: ensureStepsArray(parsed.steps),
      self_check: parsed.self_check ?? defaultShape.self_check,
      redacted_code_glimpse: parsed.redacted_code_glimpse ?? ""
    };
  };

  let sawToolArguments = false;
  let toolArgumentFailed = false;

  if (!raw && Array.isArray(toolCalls)) {
    for (const call of toolCalls) {
      const args = call?.function?.arguments;
      if (typeof args === "string" && args.trim()) {
        sawToolArguments = true;
        try {
          return tryParse(args);
        } catch (_ignored) {
          // keep trying next tool call
          toolArgumentFailed = true;
        }
      }
    }
  }

  if (!raw) {
    if (toolArgumentFailed) {
      return makeFallback("assistant tool call arguments were invalid");
    }
    if (sawToolArguments) {
      return makeFallback("assistant tool call arguments missing");
    }
    return makeFallback("assistant reply was empty");
  }

  try {
    return tryParse(raw);
  } catch (_err) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return tryParse(match[0]);
      } catch (_ignored) {
        return makeFallback("assistant JSON snippet invalid");
      }
    }
    return makeFallback("assistant reply missing JSON");
  }
}

async function callOpenAI(apiKey, model, messages){
  const body = { model, messages };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      "Authorization":`Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  
  // Check for API errors before processing
  if (data.error) {
    const error = data.error;
    const errorType = error.type || error.code || 'unknown';
    const errorMessage = error.message || 'Unknown API error';
    
    if (errorType === 'insufficient_quota' || error.code === 'insufficient_quota') {
      throw new Error(`OpenAI API quota exceeded. Please check your billing and usage at https://platform.openai.com/usage. You can also enable Mock LLM mode in Settings to test without API calls.`);
    }
    
    // Handle other common API errors
    if (errorType === 'invalid_api_key' || error.code === 'invalid_api_key') {
      throw new Error(`Invalid API key. Please check your OpenAI API key in Settings.`);
    }
    
    if (errorType === 'rate_limit_exceeded' || error.code === 'rate_limit_exceeded') {
      throw new Error(`Rate limit exceeded. Please wait a moment and try again.`);
    }
    
    // Generic API error
    throw new Error(`OpenAI API error: ${errorMessage} (${errorType})`);
  }
  
  // Check HTTP status for non-200 responses
  if (!res.ok) {
    const statusText = res.statusText || 'Unknown error';
    throw new Error(`OpenAI API request failed: ${res.status} ${statusText}. Check your API key and network connection.`);
  }
  
  // token usage if present
  const used = data?.usage?.total_tokens ??
    tokens.estimateFromText(messages.map(m=>m.content).join(" ")) +
    tokens.estimateFromText(data?.choices?.[0]?.message?.content||"");
  await tokens.bump(used);
  const rawMessage = data?.choices?.[0]?.message || null;
  return {
    content: rawMessage?.content || "",
    used,
    model,
    messages,
    rawMessage
  };
}

export async function fetchOllamaModels(ollamaUrl) {
  const url = (ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
  const endpoint = `${url}/api/tags`;
  
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type":"application/json"
      }
    });
    
    if (!res.ok) {
      // For 403 errors, log helpful message but still return empty array
      // (the actual error will show when user tries to use tutor)
      if (res.status === 403) {
        console.warn(
          '[TrailNote] Ollama CORS error (403). Restart Ollama with:\n' +
          'Windows: $env:OLLAMA_ORIGINS="chrome-extension://*"; ollama serve\n' +
          'macOS/Linux: OLLAMA_ORIGINS=chrome-extension://* ollama serve'
        );
      }
      return [];
    }
    
    const data = await res.json();
    // Ollama returns { models: [{ name: "...", ... }, ...] }
    // Handle both 'name' and 'model' fields, preserving full names with tags (e.g., "llama3:8b")
    return (data?.models || []).map(m => {
      const modelName = m.name || m.model || '';
      // Preserve the full model name including tags
      return modelName;
    }).filter(Boolean);
  } catch (error) {
    // Return empty array on error - caller will handle gracefully
    return [];
  }
}

async function callGroq(apiKey, model, messages) {
  const body = { model, messages };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  
  // Check for API errors before processing
  if (data.error) {
    const error = data.error;
    const errorType = error.type || error.code || 'unknown';
    const errorMessage = error.message || 'Unknown API error';
    
    if (errorType === 'insufficient_quota' || error.code === 'insufficient_quota') {
      throw new Error(`Groq API quota exceeded. Please check your usage at https://console.groq.com/. Groq offers a free tier to get started.`);
    }
    
    // Handle other common API errors
    if (errorType === 'invalid_api_key' || error.code === 'invalid_api_key') {
      throw new Error(`Invalid Groq API key. Please check your API key in Settings. Get your key at https://console.groq.com/keys`);
    }
    
    if (errorType === 'rate_limit_exceeded' || error.code === 'rate_limit_exceeded') {
      throw new Error(`Groq rate limit exceeded. Please wait a moment and try again.`);
    }
    
    // Generic API error
    throw new Error(`Groq API error: ${errorMessage} (${errorType})`);
  }
  
  // Check HTTP status for non-200 responses
  if (!res.ok) {
    const statusText = res.statusText || 'Unknown error';
    throw new Error(`Groq API request failed: ${res.status} ${statusText}. Check your API key and network connection.`);
  }
  
  // Token usage if present
  const used = data?.usage?.total_tokens ??
    tokens.estimateFromText(messages.map(m=>m.content).join(" ")) +
    tokens.estimateFromText(data?.choices?.[0]?.message?.content||"");
  await tokens.bump(used);
  const rawMessage = data?.choices?.[0]?.message || null;
  return {
    content: rawMessage?.content || "",
    used,
    model,
    messages,
    rawMessage
  };
}

async function callOllama(ollamaUrl, model, messages){
  const url = (ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
  const endpoint = `${url}/api/chat`;
  
  const body = {
    model: model || 'llama2',
    messages: messages,
    stream: false
  };
  
  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type":"application/json"
      },
      body: JSON.stringify(body)
    });
  } catch (networkError) {
    // Network errors (connection refused, etc.)
    if (networkError.message?.includes('Failed to fetch') || networkError.message?.includes('NetworkError')) {
      throw new Error(`Cannot connect to Ollama at ${url}. Make sure Ollama is running (try: ollama serve) and the URL is correct in Settings.`);
    }
    throw new Error(`Network error connecting to Ollama: ${networkError.message}`);
  }
  
  // Check HTTP status
  if (!res.ok) {
    let errorMessage = `Ollama request failed: ${res.status} ${res.statusText}`;
    try {
      const errorData = await res.json();
      if (errorData.error) {
        errorMessage = `Ollama error: ${errorData.error}`;
      }
    } catch (_) {
      // If response isn't JSON, use the status message
    }
    
    if (res.status === 404) {
      throw new Error(`Ollama model "${model}" not found. Install it with: ollama pull ${model}`);
    }
    
    if (res.status === 403) {
      throw new Error(
        `Ollama CORS error (403 Forbidden). Click "Get Help Fixing This" below for step-by-step instructions.`
      );
    }
    
    throw new Error(errorMessage);
  }
  
  const data = await res.json();
  
  // Ollama returns { message: { content: "...", role: "assistant" }, ... }
  const content = data?.message?.content || "";
  
  // Estimate token usage (Ollama doesn't provide usage stats)
  const used = tokens.estimateFromText(messages.map(m=>m.content).join(" ")) +
    tokens.estimateFromText(content);
  await tokens.bump(used);
  
  // Create a compatible message object
  const rawMessage = data?.message || { content, role: 'assistant' };
  
  return {
    content: content,
    used,
    model: model,
    rawMessage
  };
}

export async function tutorAnswer(mode, context, tone = "nudge") {
  const provider = await store.get('llmProvider', 'openai');
  const apiKey = await store.get('apiKey', '');
  const mockLLM = await store.get('mockLLM', false);
  const groqApiKey = await store.get('groqApiKey');
  const ollamaUrl = await store.get('ollamaUrl', 'http://localhost:11434');
  const ollamaModel = await store.get('ollamaModel', 'llama2');
  const groqModel = await store.get('groqModel', 'llama-3.1-8b-instant');
  const storedModel = await store.get('model', DEFAULT_MODEL);
  const model = SUPPORTED_MODELS.has(storedModel) ? storedModel : DEFAULT_MODEL;
  if (!SUPPORTED_MODELS.has(storedModel)) {
    console.warn(`[HintHopper Bunji] Model "${storedModel}" is not in supported list. Falling back to ${DEFAULT_MODEL}.`);
  }
  const hintMode = await store.get('hintMode', 'strict');
  const mock = await store.get('mockLLM', false);

  if (!mock) {
    if (provider === 'ollama') {
      if (!ollamaUrl || !ollamaModel) {
        throw new Error("Set your Ollama URL and model in Settings.");
      }
    } else if (provider === 'groq') {
      if (!groqApiKey) {
        throw new Error("Set your Groq API key in Settings. Get your free key at https://console.groq.com/keys");
      }
    } else {
      if (!apiKey) {
        throw new Error("Set your API key in Settings.");
      }
    }
  }
  if (!context) throw new Error("Context Preview is empty. Open a challenge on a supported platform, then wait a moment before asking again.");

  console.log('[HintHopper Bunji] Received context:', context);

  const title = context.title && context.title.trim();
  const url = context.url && context.url.trim();
  const hasCode = context.userCode && context.userCode.length > 0;
  const hasTests = context.tests && context.tests.length > 0;
  const hasChallengeUrl = !!(url && url.includes('/learn/'));
  const hasAnyMeaningfulData = Boolean(title || url || hasCode || hasTests);

  if (!hasAnyMeaningfulData) {
    throw new Error("I still can't read the challenge. Check the Context Preview tab—if it's blank, focus the code editor or run the tests, then try again.");
  }

  if (!hasCode) console.warn('[HintHopper Bunji] No code captured - will work with tests only');
  if (!hasTests) console.warn('[HintHopper Bunji] No tests captured - will work with code only');
  if (!hasCode && !hasTests && !hasChallengeUrl) {
    throw new Error("Couldn't find code or tests for this page. Open a challenge on a supported platform and make sure Context Preview shows details before asking again.");
  }

  const toneSetting = MODE_TONE[tone] ? tone : 'nudge';
  let ruleHints = context.ruleHints || '';
  
  // Generate test fingerprint for potential A/B testing
  let testFingerprint = null;
  let patternId = null;
  let abVariant = null;
  
  // If we have context and A/B testing is enabled, check for variants
  if (context && context.tests && context.tests.length > 0 && abTesting && outcomeTracker) {
    try {
      const trackingEnabled = await outcomeTracker.isEnabled();
      if (trackingEnabled) {
        // Create a fingerprint from the first test
        const testText = context.tests[0];
        testFingerprint = typeof createHash === 'function' ? 
          createHash(testText) : 
          testText.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
        
        // Try to extract a pattern ID from the test
        // This is a simplified approach - in production you'd have more sophisticated pattern matching
        if (testText.includes('<a') && testText.includes('<p')) {
          patternId = 'link-inside-first-p';
        } else if (testText.includes('alt') && testText.includes('img')) {
          patternId = 'image-alt-text';
        }

        // If we identified a pattern, get a variant
        if (patternId && testFingerprint) {
          abVariant = await abTesting.assignVariant(testFingerprint, patternId);
          console.log(`[HintHopper] Using A/B variant for ${patternId}:`, abVariant?.name || 'No variant');
        }
      }
    } catch (error) {
      console.warn('[HintHopper] Error in A/B testing:', error);
    }
  }

  const userCode = context.userCode;
  const tests = context.tests;
  const failingTests = context.failingTests;
  const promptType = context.promptType;
  const userQuery = context.userQuery;
  const challengeType = context.challengeType;

  // Query intelligence hub for intervention style and rule enrichment
  let hubEnrichment = { interventionStyle: null, ruleAdditions: '' };
  if (intelligenceHub) {
    try {
      const conceptId = context.challengeId ||
        (userQuery ? userQuery.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30) : null);
      hubEnrichment = await intelligenceHub.beforeHint({
        conceptId,
        userQuery,
        userCode,
        failingTests,
        challengeId: context.challengeId,
        struggleData: context.struggleData || { struggleLevel: context.struggleLevel || 'none' }
      });
      if (hubEnrichment.ruleAdditions) {
        ruleHints = ruleHints ? `${ruleHints} ${hubEnrichment.ruleAdditions}` : hubEnrichment.ruleAdditions;
      }
    } catch (e) {
      console.warn('[HintHopper] Hub beforeHint error (non-critical):', e);
    }
  }

  let variantType = "default"; // Default variant
  let enhancedQuery = userQuery;

  // Use NLU for query enhancement if available
  try {
    const nlu = (await import('./nlu.js')).default;
    await nlu.init();

    // Analyze the query to understand intent and improve relevance
    const analysis = await nlu.analyzeQuery(userQuery, {
      code: userCode,
      tests: tests || failingTests || [],
    });

    if (analysis) {
      // Get an enhanced query for better hint relevance
      enhancedQuery = await nlu.suggestBetterQuery(userQuery, {
        code: userCode,
        tests: tests || failingTests || []
      });

      console.log('[HintHopper] Original query:', userQuery);
      console.log('[HintHopper] Enhanced query:', enhancedQuery);
      console.log('[HintHopper] Query analysis:', analysis);
    }
  } catch (error) {
    console.warn('[HintHopper] Error using NLU:', error);
    // Continue with original query if NLU fails
  }

  // Use A/B testing if enabled
  if (abTesting) {
    const assignedVariant = await abTesting.assignVariant({
      challengeId: context.challengeId,
      conceptKey: null, // Will be determined later
      hintType: promptType
    });

    if (assignedVariant && assignedVariant.type) {
      variantType = assignedVariant.type;
      console.log(`[HintHopper] Using A/B variant: ${variantType}`);
    }
  }

  // === BKT-gated tone directive ===
  let bktDirective = '';
  let misconceptionHint = '';
  try {
    await bktEngine.init();
    const conceptIdForBkt = context.challengeId ||
      (context.title ? context.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30) : null);
    if (conceptIdForBkt) {
      const pL = bktEngine.getMastery(conceptIdForBkt);
      if (pL < 0.30) {
        bktDirective = 'Learner mastery is LOW — use a scaffolded, step-by-step approach with direct guidance.';
      } else if (pL > 0.70) {
        bktDirective = 'Learner mastery is HIGH — use a Socratic approach with probing questions to stretch their thinking.';
      }
      console.log(`[TrailNote] BKT P(L) for ${conceptIdForBkt}: ${pL.toFixed(3)} → directive: "${bktDirective || 'default'}"`); 
    }
  } catch (bktErr) {
    console.warn('[TrailNote] BKT directive error (non-critical):', bktErr);
  }

  // === Misconception detection ===
  try {
    if (pedagogicalEngine && pedagogicalEngine.detectMisconception) {
      const detected = await pedagogicalEngine.detectMisconception(
        context.userCode || '',
        context.tests || context.failingTests || []
      );
      if (detected && detected.id !== 'unknown' && detected.confidence > 0.5) {
        misconceptionHint = `Suspected issue: ${detected.name}. Focus the hint on ${detected.relatedConcepts[0] || detected.id}.`;
        console.log(`[TrailNote] Misconception detected: ${detected.name} (confidence: ${detected.confidence})`);
        // Attach to context so the panel can render the misconception chip
        context._detectedMisconception = { name: detected.name, id: detected.id };
      }
    }
  } catch (miscErr) {
    console.warn('[TrailNote] Misconception detection error (non-critical):', miscErr);
  }

  // Create the prompt, potentially using the A/B variant
  let userPrompt, systemPromptContent;

  if (abVariant) {
    // Use the variant's prompt if available
    userPrompt = abVariant.prompt ? 
      makeUserPrompt(mode, context, abVariant.prompt + '\n' + ruleHints, toneSetting) :
      makeUserPrompt(mode, context, ruleHints, toneSetting);
    
    // Use the variant's system prompt if available
    const platformPrompt = context.systemPromptAddition || '';
    systemPromptContent = abVariant.systemPrompt ?
      `${SYS_BASE.replace('{PLATFORM_CONTEXT}', platformPrompt || 'The learner is studying on an online coding platform.')}\nTone: ${MODE_TONE[toneSetting]}\n${abVariant.systemPrompt}` :
      buildSystemPrompt(toneSetting, bktDirective, misconceptionHint, platformPrompt);
  } else {
    // Use standard prompts
    const platformPrompt = context.systemPromptAddition || '';
    userPrompt = makeUserPrompt(mode, context, ruleHints, toneSetting);
    systemPromptContent = buildSystemPrompt(toneSetting, bktDirective, misconceptionHint, platformPrompt);
  }
  
  const messages = [
    { role: "system", content: systemPromptContent },
    { role: "user", content: userPrompt }
  ];

  // Use modules that were loaded at the top of the file

  // Track hint request in outcome tracker if enabled
  let hintId;
  if (outcomeTracker) {
    try {
      const trackingEnabled = await outcomeTracker.isEnabled();
      if (trackingEnabled) {
        // Start a new session if there isn't one already
        await outcomeTracker.startSession();
      }
    } catch (error) {
      console.warn('[HintHopper] Error with outcome tracking:', error);
    }
  }
  
  // Mock mode for testing without API calls
  if (mock) {
    await tokens.bump(50);
    const canned = {
      diagnosis: mode === 'concept'
        ? "You're missing the semantic structure the test expects."
        : "Wrap the target text in the required element inside the first paragraph.",
      why_it_happens: "The challenge checks that anchors live inside the first <p> element.",
      steps: mode === 'concept'
        ? [
            "Identify the required semantic container (e.g., first paragraph).",
            "Ensure the anchor wraps the target text.",
            "Confirm href matches the provided URL."
          ]
        : [
            "Find the first <p> in your HTML.",
            "Wrap the words 'cute cats' in an <a> inside that paragraph.",
            "Set the href attribute to the requested URL."
          ],
      self_check: "Does the first <p> contain an <a> with the correct text and href?",
      redacted_code_glimpse: '<p> ... <a href="..."></a> ... </p>',
      concept_key: 'link-inside-p'
    };
    
    // Track mock hint in outcome data
    if (outcomeTracker) {
      try {
        hintId = await outcomeTracker.trackHintDelivered(mode, context, canned);
      } catch (error) {
        console.warn('[HintHopper] Error tracking hint:', error);
      }
    }
    
    // Notify intelligence hub
    if (intelligenceHub && hintId) {
      intelligenceHub.afterHint(hintId, canned, context).catch(() => {});
    }
    return await sanitizeStructuredResponse(canned, hintMode === 'strict', context);
  }

  // Route to appropriate provider
  let result;
  if (provider === 'ollama') {
    result = await callOllama(ollamaUrl, ollamaModel, messages);
  } else if (provider === 'groq') {
    const validGroqModel = GROQ_MODELS.has(groqModel) ? groqModel : 'llama-3.1-8b-instant';
    if (!GROQ_MODELS.has(groqModel)) {
      console.warn(`[HintHopper Bunji] Groq model "${groqModel}" is not in supported list. Falling back to llama-3.1-8b-instant.`);
    }
    result = await callGroq(groqApiKey, validGroqModel, messages);
  } else {
    result = await callOpenAI(apiKey, model, messages);
  }
  
  const parsed = parseTutorJson(result.content, result.rawMessage?.tool_calls);
  const sanitized = await sanitizeStructuredResponse(parsed, hintMode === 'strict', context);
  // Carry detected misconception forward to the panel
  if (context._detectedMisconception) {
    sanitized.misconception = context._detectedMisconception;
  }
  
  // Track LLM hint in outcome data
  if (outcomeTracker) {
    try {
      // Add A/B testing metadata to the response
      if (abVariant && patternId) {
        sanitized.abTesting = {
          variantId: abVariant.variantId || null,
          patternId,
          testFingerprint
        };
      }
      
      hintId = await outcomeTracker.trackHintDelivered(mode, context, sanitized);
    } catch (error) {
      console.warn('[HintHopper] Error tracking hint:', error);
    }
  }

  // Notify intelligence hub after hint delivery
  if (intelligenceHub && hintId) {
    intelligenceHub.afterHint(hintId, sanitized, context).catch(() => {});
  }

  // Emit debug info if debug mode is enabled
  const dbg = await store.get('debugMode', false);
  if (dbg) {
    try {
      const debugPayload = {
        model: result.model,
        promptPreview: (messages?.[1]?.content || "").slice(0, 500),
        usedTokens: result.used,
        assistantMessage: {
          content: result.rawMessage?.content || null,
          toolCalls: result.rawMessage?.tool_calls || null
        },
        hintId: hintId // Include the hint ID for tracking
      };
      if (typeof window !== "undefined") {
        window.__hintHopperLastTutorMessage = result.rawMessage || null;
        window.__hintHopperLastHintId = hintId;
      }
      chrome.runtime.sendMessage({ type: 'DEBUG_TUTOR', debugPayload }, () => {
        const err = chrome.runtime.lastError;
        if (err && !IGNORABLE_RUNTIME_ERRORS.test(err.message || "")) {
          console.debug('[HintHopper] DEBUG_TUTOR message failed:', err.message);
        }
      });
    } catch (e) {
      console.warn('[HintHopper] Debug info error:', e);
    }
  }

  return sanitized;
}

export default { tutorAnswer, fetchOllamaModels };

