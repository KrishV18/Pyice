/**
 * PYICE AI Client — Smart Task Router
 * ─────────────────────────────────────────────────────────────────────────────
 * Three-layer architecture:
 *
 *   GroqClient   — Primary provider (OpenAI-compatible REST API, fast inference)
 *   GeminiClient — Fallback provider (Google Gemini, used for SVG-quality notes)
 *   AIRouter     — Task dispatcher (reads MODEL_ROUTER, picks provider, retries,
 *                  falls back, and exposes a single generateContent() interface)
 *
 * Call-sites in quiz.js / notes.js / language.js use AIRouter.generateContent()
 * with a `task` key instead of a `model` key — zero changes required there.
 *
 * Dependencies (loaded before this file via manifest.json):
 *   config.js    → HARDCODED_API_KEY (Gemini key)
 *   constants.js → GEMINI_API_BASE, GROQ_API_BASE, MODEL_ROUTER, API_DEFAULTS
 *   storage.js   → PyiceStorage.getApiKey(), PyiceStorage.getGroqApiKey()
 */

// ── Custom Error Types ─────────────────────────────────────────────────────────

class ApiKeyMissingError extends Error {
  constructor(provider = 'Gemini') {
    super(`API key not configured. Please set your ${provider} API key in the PYICE extension popup.`);
    this.name = 'ApiKeyMissingError';
  }
}

class ApiTimeoutError extends Error {
  constructor() {
    super('API request timed out. Please try again.');
    this.name = 'ApiTimeoutError';
  }
}

class ApiParseError extends Error {
  constructor(detail) {
    super(`Failed to parse AI response: ${detail}`);
    this.name = 'ApiParseError';
  }
}

class ApiNetworkError extends Error {
  constructor(status, detail) {
    super(`API request failed (${status}): ${detail}`);
    this.name = 'ApiNetworkError';
    this.status = status;
  }
}



// ── Gemini Client (fallback / SVG quality) ─────────────────────────────────────

class GeminiClient {

  /**
   * Send a prompt to the Gemini API.
   *
   * @param {string}  prompt
   * @param {Object}  options
   * @param {string}  [options.model]           - Gemini model ID
   * @param {number}  [options.maxOutputTokens]
   * @param {number}  [options.temperature]
   * @param {number}  [options.topK]
   * @param {number}  [options.topP]
   * @param {number}  [options.timeoutMs]
   * @param {boolean} [options.parseJson]       - Parse response as JSON (default: true)
   * @returns {Promise<Object|string>}
   */
  static async generateContent(prompt, options = {}) {
    const {
      model           = MODEL_ROUTER.notes.fallback.model,
      maxOutputTokens = API_DEFAULTS.NOTES_MAX_TOKENS,
      temperature,
      topK,
      topP,
      timeoutMs       = API_DEFAULTS.TIMEOUT_MS,
      parseJson       = true
    } = options;

    const apiKey = await PyiceStorage.getApiKey();
    if (!apiKey) throw new ApiKeyMissingError('Gemini');

    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

    const generationConfig = { maxOutputTokens };
    if (temperature !== undefined)  generationConfig.temperature    = temperature;
    if (topK        !== undefined)  generationConfig.topK           = topK;
    if (topP        !== undefined)  generationConfig.topP           = topP;
    if (parseJson)                  generationConfig.responseMimeType = 'application/json';

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig
    };

    const rawText = await GeminiClient._fetchWithTimeout(url, body, timeoutMs);

    if (parseJson) return GeminiClient.parseJsonResponse(rawText);
    return rawText;
  }

  /** @private */
  static async _fetchWithTimeout(url, body, timeoutMs) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body:    JSON.stringify(body),
        signal:  controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`PYICE Gemini: API Error ${response.status}:`, errorText);
        throw new ApiNetworkError(response.status, errorText);
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        console.error('PYICE Gemini: Invalid response structure:', data);
        throw new ApiParseError('Invalid response structure from Gemini API');
      }

      return data.candidates[0].content.parts[0].text;

    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError')   throw new ApiTimeoutError();
      if (error instanceof ApiNetworkError || error instanceof ApiParseError) throw error;
      throw new ApiNetworkError(0, error.message || 'Network request failed');
    }
  }

  /**
   * Parse a raw AI text response as JSON.
   * Shared by both GroqClient and GeminiClient.
   * Three-pass strategy: strip fences → extract array → extract object.
   */
  static parseJsonResponse(rawText) {
    // Pass 1: Strip markdown fences
    try {
      const cleaned = rawText.replace(/```json\s*|\s*```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (_) { /* continue */ }

    // Pass 2: Extract JSON array
    try {
      const arrayMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) return JSON.parse(arrayMatch[0]);
    } catch (_) { /* continue */ }

    // Pass 3: Extract JSON object
    try {
      const objectMatch = rawText.match(/\{[\s\S]*\}/);
      if (objectMatch) return JSON.parse(objectMatch[0]);
    } catch (_) { /* fall through */ }

    throw new ApiParseError('No valid JSON found in AI response');
  }
}

// ── AI Router (task-aware dispatcher) ─────────────────────────────────────────

/**
 * AIRouter — single entry point for all AI calls in PYICE.
 *
 * Usage (preferred — task-based):
 *   await AIRouter.generateContent(prompt, { task: 'quiz' })
 *   await AIRouter.generateContent(prompt, { task: 'notes' })
 *   await AIRouter.generateContent(prompt, { task: 'translate', parseJson: false })
 *   await AIRouter.generateContent(prompt, { task: 'detect',    parseJson: false })
 *
 * Usage (legacy — model-based, for backward compat):
 *   await AIRouter.generateContent(prompt, { model: GEMINI_MODELS.QUIZ, ... })
 *
 * The router:
 *   1. Resolves the task config from MODEL_ROUTER (or falls back to legacy Gemini path).
 *   2. Calls the correct provider client (GroqClient / GeminiClient).
 *   3. On failure, retries up to API_DEFAULTS.RETRY_COUNT times.
 *   4. For 'notes', automatically falls back to GeminiClient on Groq failure.
 *   5. Re-throws only on non-retryable errors (key missing, parse error).
 */
class AIRouter {

  /**
   * @param {string}  prompt
   * @param {Object}  options
   * @param {string}  [options.task]       - 'quiz' | 'notes' | 'translate' | 'detect'
   * @param {string}  [options.model]      - Legacy: Gemini model name (bypasses router)
   * @param {boolean} [options.parseJson]  - Override JSON parsing (default: task config)
   * @param {number}  [options.timeoutMs]  - Override timeout
   * @returns {Promise<Object|string>}
   */
  static async generateContent(prompt, options = {}) {
    const { task, model: legacyModel, parseJson, timeoutMs } = options;

    // ── Legacy path: caller passed a raw `model` name (Gemini) ──────────────
    if (!task && legacyModel) {
      return AIRouter._callWithRetry(
        () => GeminiClient.generateContent(prompt, options),
        'gemini-legacy'
      );
    }

    // ── Task-based path ──────────────────────────────────────────────────────
    const taskKey    = task || 'quiz';
    const taskConfig = MODEL_ROUTER[taskKey];

    if (!taskConfig) {
      console.warn(`PYICE AIRouter: Unknown task "${taskKey}", falling back to Gemini`);
      return AIRouter._callWithRetry(
        () => GeminiClient.generateContent(prompt, options),
        taskKey
      );
    }

    // Merge per-call overrides with task defaults
    const resolvedParseJson = parseJson !== undefined ? parseJson : true;
    const resolvedTimeout   = timeoutMs || API_DEFAULTS.TIMEOUT_MS;

    // provider === 'gemini' (explicit)
    return AIRouter._callWithRetry(
      () => GeminiClient.generateContent(prompt, {
        model:           taskConfig.model,
        maxOutputTokens: taskConfig.maxTokens,
        temperature:     taskConfig.temperature,
        timeoutMs:       resolvedTimeout,
        parseJson:       resolvedParseJson
      }),
      `gemini:${taskKey}`
    );
  }

  /**
   * Retry wrapper — retries on network/timeout errors, not on key/parse errors.
   * @private
   */
  static async _callWithRetry(fn, label) {
    let lastError;

    for (let attempt = 0; attempt <= API_DEFAULTS.RETRY_COUNT; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Never retry on these — user action required or response is genuinely bad
        if (error instanceof ApiKeyMissingError || error instanceof ApiParseError) {
          throw error;
        }

        if (attempt < API_DEFAULTS.RETRY_COUNT) {
          console.warn(
            `PYICE AIRouter [${label}]: Attempt ${attempt + 1} failed, ` +
            `retrying in ${API_DEFAULTS.RETRY_DELAY_MS}ms…`, error.message
          );
          await new Promise(r => setTimeout(r, API_DEFAULTS.RETRY_DELAY_MS));
        }
      }
    }

    throw lastError;
  }
}

// ── Log ────────────────────────────────────────────────────────────────────────
console.log('🤖 PYICE AI client loaded — Gemini Router active:', {
  quiz:      `gemini:${MODEL_ROUTER.quiz.model}`,
  notes:     `gemini:${MODEL_ROUTER.notes.model}`,
  translate: `gemini:${MODEL_ROUTER.translate.model}`,
  detect:    `gemini:${MODEL_ROUTER.detect.model}`
});
