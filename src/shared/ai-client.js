/**
 * PYICE AI Client
 * Unified Gemini API client with retry, timeout, and JSON parsing.
 * Used by both quiz and notes generators.
 */

// ── Custom Error Types ─────────────────────────────────────────────────────────

class ApiKeyMissingError extends Error {
  constructor() {
    super('API key not configured. Please set your Gemini API key in the PYICE extension popup.');
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

// ── Gemini Client ──────────────────────────────────────────────────────────────

class GeminiClient {

  /**
   * Send a prompt to the Gemini API and get parsed JSON or raw text back.
   *
   * @param {string} prompt - The text prompt to send
   * @param {Object} options
   * @param {string} [options.model] - Model name (default: GEMINI_MODELS.QUIZ)
   * @param {number} [options.maxOutputTokens] - Max tokens (default: API_DEFAULTS.QUIZ_MAX_TOKENS)
   * @param {number} [options.temperature] - Temperature (default: undefined / server default)
   * @param {number} [options.topK] - Top K (default: undefined)
   * @param {number} [options.topP] - Top P (default: undefined)
   * @param {number} [options.timeoutMs] - Timeout in ms (default: API_DEFAULTS.TIMEOUT_MS)
   * @param {boolean} [options.parseJson] - Whether to parse response as JSON (default: true)
   * @returns {Promise<Object|string>} Parsed JSON object/array, or raw text if parseJson=false
   */
  static async generateContent(prompt, options = {}) {
    const {
      model = GEMINI_MODELS.QUIZ,
      maxOutputTokens = API_DEFAULTS.QUIZ_MAX_TOKENS,
      temperature,
      topK,
      topP,
      timeoutMs = API_DEFAULTS.TIMEOUT_MS,
      parseJson = true
    } = options;

    // Get API key from storage
    const apiKey = await PyiceStorage.getApiKey();
    if (!apiKey) {
      throw new ApiKeyMissingError();
    }

    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

    // Build generation config
    const generationConfig = { maxOutputTokens };
    if (temperature !== undefined) generationConfig.temperature = temperature;
    if (topK !== undefined) generationConfig.topK = topK;
    if (topP !== undefined) generationConfig.topP = topP;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig
    };

    // Attempt with retry
    let lastError;
    for (let attempt = 0; attempt <= API_DEFAULTS.RETRY_COUNT; attempt++) {
      try {
        const rawText = await GeminiClient._fetchWithTimeout(url, body, timeoutMs);

        if (parseJson) {
          return GeminiClient.parseJsonResponse(rawText);
        }
        return rawText;

      } catch (error) {
        lastError = error;

        // Don't retry on key missing or parse errors
        if (error instanceof ApiKeyMissingError || error instanceof ApiParseError) {
          throw error;
        }

        // Retry on network/timeout errors
        if (attempt < API_DEFAULTS.RETRY_COUNT) {
          console.warn(`PYICE AI: Attempt ${attempt + 1} failed, retrying in ${API_DEFAULTS.RETRY_DELAY_MS}ms...`, error.message);
          await new Promise(r => setTimeout(r, API_DEFAULTS.RETRY_DELAY_MS));
        }
      }
    }

    throw lastError;
  }

  /**
   * Internal: fetch with AbortController timeout.
   */
  static async _fetchWithTimeout(url, body, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`PYICE AI: API Error ${response.status}:`, errorText);
        throw new ApiNetworkError(response.status, errorText);
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        console.error('PYICE AI: Invalid response structure:', data);
        throw new ApiParseError('Invalid response structure from Gemini API');
      }

      return data.candidates[0].content.parts[0].text;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new ApiTimeoutError();
      }
      if (error instanceof ApiNetworkError || error instanceof ApiParseError) {
        throw error;
      }
      // Generic network error (e.g. no internet)
      throw new ApiNetworkError(0, error.message || 'Network request failed');
    }
  }

  /**
   * Parse a raw AI text response as JSON.
   * Two-pass strategy: clean markdown fences first, then regex extract.
   */
  static parseJsonResponse(rawText) {
    // Pass 1: Strip markdown fences and parse
    try {
      const cleaned = rawText.replace(/```json\s*|\s*```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      // Continue to pass 2
    }

    // Pass 2: Try to extract JSON array
    try {
      const arrayMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }
    } catch (e) {
      // Continue
    }

    // Pass 3: Try to extract JSON object
    try {
      const objectMatch = rawText.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }
    } catch (e) {
      // Fall through
    }

    throw new ApiParseError('No valid JSON found in AI response');
  }
}

console.log('🤖 PYICE AI client loaded');
