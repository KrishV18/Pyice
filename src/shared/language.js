/**
 * PYICE Language Module
 * Language detection and translation via Gemini API.
 * Shared by both quiz and notes generators.
 */

/**
 * Detect the language of the given text.
 * Currently detects Hindi vs English via regex heuristics.
 *
 * @param {string} text - Text to analyze
 * @returns {string} Language code ('en', 'hi', etc.)
 */
function detectLanguage(text) {
  const sample = text.substring(0, 500);

  // Devanagari script or common Hindi words
  if (/[\u0900-\u097F]/.test(sample) || /(है|हैं|का|की|के|में|से|को|और|या|यह|वह)/.test(sample)) {
    return 'hi';
  }

  // Chinese characters
  if (/[\u4e00-\u9fff]/.test(sample)) return 'zh';
  // Japanese (Hiragana/Katakana)
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(sample)) return 'ja';
  // Korean (Hangul)
  if (/[\uac00-\ud7af]/.test(sample)) return 'ko';
  // Arabic
  if (/[\u0600-\u06ff]/.test(sample)) return 'ar';
  // Cyrillic (Russian)
  if (/[\u0400-\u04ff]/.test(sample)) return 'ru';

  return 'en';
}

/**
 * Get the human-readable name for a language code.
 *
 * @param {string} code - Language code
 * @returns {string} Language name
 */
function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}

/**
 * Translate text to English using the Gemini API.
 * Returns the original text if translation fails.
 *
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @returns {Promise<string>} Translated text (or original on failure)
 */
async function translateToEnglish(text, sourceLang) {
  if (sourceLang === 'en') return text;

  try {
    const langName = getLanguageName(sourceLang);
    const prompt = `Translate this ${langName} text to English, maintaining educational context. Return ONLY the translated text, nothing else:\n\n"${text}"`;

    const translated = await GeminiClient.generateContent(prompt, {
      model: GEMINI_MODELS.TRANSLATE,
      parseJson: false,
      timeoutMs: 20000
    });

    return translated || text;
  } catch (error) {
    console.warn('PYICE: Translation failed, using original text:', error.message);
    return text;
  }
}

/**
 * Detect language and translate to English if needed.
 * Convenience wrapper combining detectLanguage + translateToEnglish.
 *
 * @param {string} text - Input text
 * @param {function} [onStatus] - Optional status callback
 * @returns {Promise<{text: string, detectedLang: string}>}
 */
async function ensureEnglish(text, onStatus) {
  const detectedLang = detectLanguage(text);

  if (detectedLang !== 'en') {
    if (onStatus) {
      onStatus(`🌍 Detected ${getLanguageName(detectedLang)} content. Translating...`);
    }

    try {
      const translated = await translateToEnglish(text, detectedLang);
      if (onStatus) {
        onStatus('✅ Translation completed');
      }
      return { text: translated, detectedLang };
    } catch (error) {
      console.warn('PYICE: Translation failed, proceeding with original text');
      return { text, detectedLang };
    }
  }

  return { text, detectedLang: 'en' };
}

console.log('🌐 PYICE language module loaded');
