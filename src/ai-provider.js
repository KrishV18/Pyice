// =============================================================================
// PYICE — ai-provider.js
// Phase 3: Chrome AI → WebLLM (Phi-3 Mini) → Local Fallback
// + Transformers.js for language detection and classification
// =============================================================================

import { MLCEngine } from '@mlc-ai/web-llm';
import { pipeline, env } from '@huggingface/transformers';

// Tell Transformers.js to use the browser cache (no server needed)
env.allowLocalModels = false;
env.useBrowserCache = true;

// =============================================================================
//  PROMPTS (identical to Phase 2 — keeping them here for completeness)
// =============================================================================

const PROMPTS = {

  QUIZ_SYSTEM: `You are an expert educational quiz generator.
You always respond with a single valid JSON object and nothing else.
No markdown. No explanation. No code fences. Only JSON.`,

  QUIZ_USER: (transcript, difficulty, language) => `Generate a 7-question educational quiz from the transcript below.

Difficulty: ${difficulty}   Language for all text: ${language}

Respond with ONLY this JSON — no extra text before or after:
{
  "title": "quiz title derived from content",
  "topic": "subject area e.g. Physics, History, Biology",
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "question": "question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "brief explanation of the correct answer",
      "timestamp": 45
    }
  ]
}

Rules:
- Use all 4 types across the 7 questions: mcq, true_false, fill_blank, short_answer
- mcq: 4 options, correct = index (0, 1, 2, or 3)
- true_false: options = ["True", "False"], correct = 0 or 1
- fill_blank: question contains exactly one [blank], options = 4 choices
- short_answer: no options field, correct = the expected answer string
- timestamp: approximate second in the video where that concept appears
- Questions must test understanding and application, not just recall
- Difficulty ${difficulty}: ${difficulty === 'easy' ? 'definitions and basic facts' : difficulty === 'medium' ? 'application and connections between concepts' : 'analysis, evaluation, and edge cases'}

TRANSCRIPT:
${transcript.slice(0, 3500)}`,

  NOTES_SYSTEM: `You are an expert educational content analyst.
You always respond with a single valid JSON object and nothing else.
No markdown. No explanation. No code fences. Only JSON.`,

  NOTES_USER: (transcript, language) => `Analyze the transcript below and generate comprehensive study notes.

All text content must be in: ${language}

Respond with ONLY this JSON — no extra text before or after:
{
  "title": "topic name",
  "subject": "Physics / Chemistry / Biology / History / Math / CS / Economics / Other",
  "summary": "2-3 sentence plain English overview",
  "keyPoints": ["takeaway 1", "takeaway 2", "takeaway 3", "takeaway 4", "takeaway 5"],
  "concepts": [
    {
      "name": "concept name",
      "explanation": "clear 1-2 sentence explanation",
      "example": "concrete real-world example"
    }
  ],
  "diagrams": [
    {
      "type": "process_flow",
      "title": "diagram title",
      "data": { "steps": ["Step 1", "Step 2", "Step 3"], "highlight": 0 }
    }
  ],
  "flashcards": [{ "front": "term", "back": "definition" }],
  "formulae": ["F = ma"]
}

Diagram types:
  process_flow  → data: { steps: string[], highlight: number }
  hierarchy     → data: { root: string, children: [{name, children}] }
  comparison    → data: { cols: string[], rows: string[][] }
  timeline      → data: { events: [{date, label}] }
  cycle         → data: { stages: string[] }
  formula       → data: { equation: string, variables: [{sym, name, unit}] }
  mindmap       → data: { center: string, branches: [{label, items}] }
  cause_effect  → data: { causes: string[], effect: string }
  pros_cons     → data: { pros: string[], cons: string[] }

TRANSCRIPT:
${transcript.slice(0, 3500)}`,

};

// =============================================================================
//  CHROME AI PROVIDER (Phase 2 — unchanged)
// =============================================================================

class ChromeAIProvider {
  constructor() {
    this.name = 'ChromeAI';
    this._availabilityCache = null;
  }

  async isAvailable() {
    if (this._availabilityCache !== null) return this._availabilityCache;
    try {
      if (!window.ai?.languageModel) { this._availabilityCache = false; return false; }
      const caps = await window.ai.languageModel.capabilities();
      this._availabilityCache = caps.available === 'readily';
      return this._availabilityCache;
    } catch { this._availabilityCache = false; return false; }
  }

  async generate(userPrompt, systemPrompt, timeoutMs = 25000) {
    const session = await window.ai.languageModel.create({ systemPrompt, temperature: 0.7, topK: 40 });
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await Promise.race([
        session.prompt(userPrompt),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('timeout')))),
      ]);
    } finally { clearTimeout(tid); session.destroy(); }
  }
}

// =============================================================================
//  WEBLLM PROVIDER (Phase 3 — new)
// =============================================================================

class WebLLMProvider {
  constructor() {
    this.name = 'WebLLM';
    this.engine = null;
    this.isLoaded = false;
    this.isLoading = false;

    // Model choice: Phi-3 Mini 4K is the best balance of quality vs size
    // Alternative: "gemma-2-2b-it-q4f16_1-MLC" (~1.5 GB, slightly lower quality)
    this.modelId = 'Phi-3-mini-4k-instruct-q4f16_1-MLC';
  }

  // Check if WebGPU is available (required for WebLLM)
  async isAvailable() {
    try {
      if (!navigator.gpu) return false;
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch { return false; }
  }

  // Load the model — shows download screen on first run
  // Subsequent calls return immediately (model is cached)
  async load() {
    if (this.isLoaded) return true;
    if (this.isLoading) {
      // Already loading — wait for it
      return new Promise(resolve => {
        const check = setInterval(() => {
          if (this.isLoaded || !this.isLoading) { clearInterval(check); resolve(this.isLoaded); }
        }, 500);
      });
    }

    this.isLoading = true;
    this._showDownloadScreen();

    try {
      this.engine = new MLCEngine();
      await this.engine.reload(this.modelId, {
        initProgressCallback: (progress) => {
          this._updateDownloadProgress(progress.progress, progress.text);
        }
      });
      this.isLoaded = true;
      this._hideDownloadScreen();
      return true;
    } catch (err) {
      this.isLoading = false;
      this._hideDownloadScreen();
      console.error('[PYICE] WebLLM load failed:', err.message);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  // One-shot generation
  async generate(userPrompt, systemPrompt, timeoutMs = 45000) {
    if (!this.isLoaded) throw new Error('WebLLM not loaded');

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const reply = await this.engine.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 3000,
      });
      return reply.choices[0].message.content;
    } finally {
      clearTimeout(tid);
    }
  }

  // Streaming generation — onChunk(delta, fullSoFar) called for each token
  // Returns the full response string when complete
  async stream(userPrompt, systemPrompt, onChunk) {
    if (!this.isLoaded) throw new Error('WebLLM not loaded');

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });

    const completion = await this.engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 3000,
      stream: true,
    });

    let fullText = '';
    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        onChunk(delta, fullText);
      }
    }
    return fullText;
  }

  // ── Download screen helpers ────────────────────────────────────────────────

  _showDownloadScreen() {
    const screen = document.getElementById('pyice-download-screen');
    if (screen) screen.style.display = 'flex';
  }

  _hideDownloadScreen() {
    const screen = document.getElementById('pyice-download-screen');
    if (screen) screen.style.display = 'none';
  }

  _updateDownloadProgress(progress, text) {
    const bar = document.getElementById('pyice-dl-bar');
    const pct = document.getElementById('pyice-dl-percent');
    const txt = document.getElementById('pyice-dl-text');
    const mb  = document.getElementById('pyice-dl-mb');

    const percent = Math.round(progress * 100);
    if (bar) bar.style.width = percent + '%';
    if (pct) pct.textContent = percent + '%';
    if (txt) txt.textContent = text || 'Loading...';
    if (mb)  mb.textContent = `${Math.round(progress * 2400)} MB / ~2400 MB`;
  }
}

// =============================================================================
//  TRANSFORMERS.JS UTILITIES (Phase 3 — replaces API calls for classification)
// =============================================================================

class TransformersUtils {
  constructor() {
    this._langDetector = null;
    this._classifier = null;
  }

  // Detect language of text — returns ISO code like "en", "hi", "es", "fr"
  // Model: ~85MB, downloads once and caches
  async detectLanguage(text) {
    if (!this._langDetector) {
      console.log('[PYICE] Loading language detection model (~85MB, one-time)...');
      this._langDetector = await pipeline(
        'text-classification',
        'Xenova/language-detection-fine-tuned-on-fleurs-dataset',
        { device: 'wasm' } // CPU fallback — no GPU needed for this tiny model
      );
    }
    const result = await this._langDetector(text.slice(0, 300));
    return result[0].label; // e.g. "en", "hi", "es"
  }

  // Classify subject area — returns the most likely subject label
  // Model: ~180MB, downloads once and caches
  async classifySubject(text) {
    if (!this._classifier) {
      console.log('[PYICE] Loading classification model (~180MB, one-time)...');
      this._classifier = await pipeline(
        'zero-shot-classification',
        'Xenova/nli-deberta-v3-small',
        { device: 'wasm' }
      );
    }
    const labels = [
      'mathematics', 'physics', 'chemistry', 'biology',
      'history', 'computer science', 'economics', 'literature', 'general'
    ];
    const result = await this._classifier(text.slice(0, 500), labels);
    return result.labels[0]; // highest-confidence label
  }
}

// =============================================================================
//  AI PROVIDER CHAIN — Full 3-layer chain
//  Chrome AI → WebLLM → Local Fallback
// =============================================================================

class AIProviderChain {
  constructor() {
    this.chromeAI = new ChromeAIProvider();
    this.webLLM   = new WebLLMProvider();
    this.transformers = new TransformersUtils();
    this.activeProvider = null;
  }

  getActiveProviderName() {
    return this.activeProvider || 'Local';
  }

  updateBadge() {
    const badge = document.getElementById('pyice-ai-badge');
    if (!badge) return;
    const names = {
      'ChromeAI': { text: '🔒 On-device AI', color: '#3B6D11', bg: '#EAF3DE' },
      'WebLLM':   { text: '⚡ On-device AI', color: '#0C447C', bg: '#E6F1FB' },
      'Local':    { text: '📦 Local mode',   color: '#854F0B', bg: '#FAEEDA' },
    };
    const info = names[this.activeProvider] || names['Local'];
    badge.textContent = info.text;
    badge.style.cssText = `
      display:inline-flex; align-items:center; gap:4px; font-size:11px;
      padding:3px 9px; border-radius:20px; border:0.5px solid ${info.color};
      font-weight:500; cursor:help; color:${info.color}; background:${info.bg};
    `;
  }

  // ── Quiz generation ────────────────────────────────────────────────────────

  async generateQuiz(transcript, difficulty = 'medium', language = 'English') {
    const user = PROMPTS.QUIZ_USER(transcript, difficulty, language);
    const sys  = PROMPTS.QUIZ_SYSTEM;

    // Layer 1: Chrome AI
    if (await this.chromeAI.isAvailable()) {
      try {
        this.activeProvider = 'ChromeAI';
        const raw = await this.chromeAI.generate(user, sys, 25000);
        const parsed = this._parseJSON(raw, 'quiz');
        this.updateBadge();
        return parsed;
      } catch (err) { console.warn('[PYICE] ChromeAI failed:', err.message); }
    }

    // Layer 2: WebLLM
    if (await this.webLLM.isAvailable()) {
      try {
        this.activeProvider = 'WebLLM';
        const loaded = await this.webLLM.load(); // shows download screen if needed
        if (loaded) {
          const raw = await this.webLLM.generate(user, sys, 45000);
          const parsed = this._parseJSON(raw, 'quiz');
          this.updateBadge();
          return parsed;
        }
      } catch (err) { console.warn('[PYICE] WebLLM failed:', err.message); }
    }

    // Layer 3: Local
    this.activeProvider = 'Local';
    this.updateBadge();
    throw new Error('USE_LOCAL_FALLBACK');
  }

  // ── Quiz generation with streaming (PREFERRED — shows questions appearing) ─

  async generateQuizStreaming(transcript, difficulty = 'medium', language = 'English', onProgress) {
    const user = PROMPTS.QUIZ_USER(transcript, difficulty, language);
    const sys  = PROMPTS.QUIZ_SYSTEM;

    // Chrome AI streaming
    if (await this.chromeAI.isAvailable()) {
      try {
        this.activeProvider = 'ChromeAI';
        let fullText = '';
        await this.chromeAI.stream(user, sys, (delta, full) => {
          fullText = full;
          if (onProgress) onProgress(full); // show raw stream as typing indicator
        });
        const parsed = this._parseJSON(fullText, 'quiz');
        this.updateBadge();
        return parsed;
      } catch (err) { console.warn('[PYICE] ChromeAI stream failed:', err.message); }
    }

    // WebLLM streaming
    if (await this.webLLM.isAvailable()) {
      try {
        this.activeProvider = 'WebLLM';
        const loaded = await this.webLLM.load();
        if (loaded) {
          let fullText = '';
          // Show a "Generating..." progress counter as questions stream in
          let qCount = 0;
          await this.webLLM.stream(user, sys, (delta, full) => {
            fullText = full;
            // Count how many questions have appeared in the stream so far
            const matches = full.match(/"id"\s*:\s*\d+/g);
            const newCount = matches ? matches.length : 0;
            if (newCount > qCount && onProgress) {
              qCount = newCount;
              onProgress(full, qCount); // call with (rawText, questionsGeneratedSoFar)
            }
          });
          const parsed = this._parseJSON(fullText, 'quiz');
          this.updateBadge();
          return parsed;
        }
      } catch (err) { console.warn('[PYICE] WebLLM stream failed:', err.message); }
    }

    // Fallback
    this.activeProvider = 'Local';
    this.updateBadge();
    throw new Error('USE_LOCAL_FALLBACK');
  }

  // ── Notes generation ───────────────────────────────────────────────────────

  async generateNotes(transcript, language = 'English') {
    const user = PROMPTS.NOTES_USER(transcript, language);
    const sys  = PROMPTS.NOTES_SYSTEM;

    if (await this.chromeAI.isAvailable()) {
      try {
        this.activeProvider = 'ChromeAI';
        const raw = await this.chromeAI.generate(user, sys, 35000);
        const parsed = this._parseJSON(raw, 'notes');
        this.updateBadge();
        return parsed;
      } catch (err) { console.warn('[PYICE] ChromeAI notes failed:', err.message); }
    }

    if (await this.webLLM.isAvailable()) {
      try {
        this.activeProvider = 'WebLLM';
        const loaded = await this.webLLM.load();
        if (loaded) {
          const raw = await this.webLLM.generate(user, sys, 60000);
          const parsed = this._parseJSON(raw, 'notes');
          this.updateBadge();
          return parsed;
        }
      } catch (err) { console.warn('[PYICE] WebLLM notes failed:', err.message); }
    }

    this.activeProvider = 'Local';
    this.updateBadge();
    throw new Error('USE_LOCAL_FALLBACK');
  }

  // ── Language detection (replaces API call with offline Transformers.js) ────

  async detectLanguage(text) {
    try {
      return await this.transformers.detectLanguage(text);
    } catch {
      return 'en'; // safe fallback
    }
  }

  // ── Subject classification ─────────────────────────────────────────────────

  async detectSubject(transcript) {
    try {
      return await this.transformers.classifySubject(transcript);
    } catch {
      // Fall back to Chrome AI if available
      if (await this.chromeAI.isAvailable()) {
        try {
          const result = await this.chromeAI.generate(
            `What subject is this about?\n\n${transcript.slice(0, 400)}`,
            `Respond with one word from: Physics Chemistry Biology Mathematics History ComputerScience Economics Literature Other`
          );
          return result.trim().split(/\s+/)[0];
        } catch {}
      }
      return 'General';
    }
  }

  // ── JSON parsing ───────────────────────────────────────────────────────────

  _parseJSON(raw, context) {
    let text = raw.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) text = text.slice(start, end + 1);
    text = text.replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error(`[PYICE] JSON parse failed (${context}):`, err.message);
      throw new Error(`PARSE_FAILED_${context.toUpperCase()}`);
    }
  }
}

// =============================================================================
//  GLOBAL EXPORTS
// =============================================================================

window.PyiceAI = new AIProviderChain();
window.PyicePrompts = PROMPTS;
