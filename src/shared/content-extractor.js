/**
 * PYICE Content Extractor
 * Unified content extraction pipeline for YouTube videos.
 * Shared by both quiz and notes generators.
 *
 * Priority: YouTube TimedText API → Page Transcript DOM → Live Captions → Manual Input
 */

class ContentExtractor {
  constructor() {
    this.captionText = '';
    this.isCollecting = false;
    this.captionObserver = null;
    this._captionCheckInterval = null;
  }

  // ── Video ID ─────────────────────────────────────────────────────────────

  /**
   * Extract YouTube video ID from the current page URL.
   * @returns {string|null}
   */
  getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v') || null;
  }

  // ── Full Extraction Pipeline ─────────────────────────────────────────────

  /**
   * Attempt to extract content using all available methods in priority order.
   *
   * @param {Object} callbacks
   * @param {function} callbacks.onStatus - Called with status messages
   * @param {function} callbacks.onSuccess - Called with extracted text
   * @param {function} callbacks.onFallbackToManual - Called if all auto methods fail
   * @param {number} [minChars] - Minimum chars to consider extraction complete
   */
  async extractContent(callbacks, minChars = CONTENT_THRESHOLDS.MIN_QUIZ_CHARS) {
    const { onStatus, onSuccess, onFallbackToManual } = callbacks;

    // Method 1: YouTube TimedText API
    onStatus('🔍 Attempting to fetch transcript via API...');
    const videoId = this.getVideoId();
    if (videoId) {
      try {
        const apiText = await this.fetchApiTranscript(videoId);
        if (apiText && apiText.trim().length >= minChars) {
          this.captionText = apiText;
          onStatus('✅ Transcript fetched successfully via API');
          onSuccess(this.captionText);
          return;
        }
      } catch (error) {
        console.warn('PYICE: API transcript fetch failed:', error);
      }
    }

    // Method 2: Page Transcript DOM
    onStatus('🔍 Checking for page transcript...');
    if (this.checkPageTranscript()) {
      try {
        const pageText = await this.extractPageTranscript();
        if (pageText && pageText.trim().length >= minChars) {
          this.captionText = pageText;
          onStatus('✅ Transcript extracted from page');
          onSuccess(this.captionText);
          return;
        }
      } catch (error) {
        console.warn('PYICE: Page transcript extraction failed:', error);
      }
    }

    // Method 3: Live Captions
    onStatus('🎧 Starting live caption collection... (play the video)');
    this.startCaptionObserver(
      (currentText) => {
        onStatus(`📝 Collecting captions: ${currentText.length} chars...`);
        if (currentText.length >= minChars) {
          this.stopCaptionObserver();
          onSuccess(this.captionText);
        }
      },
      minChars
    );

    // Set a timeout: if captions don't come in 60s, offer manual input
    setTimeout(() => {
      if (this.isCollecting && this.captionText.length < minChars) {
        this.stopCaptionObserver();
        onFallbackToManual();
      }
    }, 60000);
  }

  // ── Method 1: YouTube TimedText API ──────────────────────────────────────

  /**
   * Fetch transcript from YouTube's internal timedtext API.
   * @param {string} videoId
   * @returns {Promise<string>}
   */
  async fetchApiTranscript(videoId) {
    const languages = ['en', 'en-US', 'en-GB', 'hi'];

    for (const lang of languages) {
      try {
        const url = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}`;
        const response = await fetch(url);

        if (response.ok) {
          const text = await response.text();
          if (text && text.trim().length > 0) {
            // Parse XML response
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');
            const textNodes = xmlDoc.querySelectorAll('text');

            if (textNodes.length > 0) {
              const extracted = Array.from(textNodes)
                .map(node => node.textContent)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();

              if (extracted.length > 0) {
                console.log(`PYICE: Fetched transcript (${lang}): ${extracted.length} chars`);
                return extracted;
              }
            }
          }
        }
      } catch (error) {
        console.warn(`PYICE: TimedText API failed for lang=${lang}:`, error);
      }
    }

    return '';
  }

  // ── Method 2: Page Transcript DOM ────────────────────────────────────────

  /**
   * Check if transcript segments exist in the page DOM.
   * @returns {boolean}
   */
  checkPageTranscript() {
    for (const selector of YT_SELECTORS.TRANSCRIPT_SELECTORS) {
      try {
        if (document.querySelector(selector)) return true;
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return false;
  }

  /**
   * Extract transcript text from the page DOM.
   * @returns {Promise<string>}
   */
  async extractPageTranscript() {
    // Try to open transcript panel if not visible
    await this._tryOpenTranscript();

    // Wait a moment for DOM to update
    await new Promise(r => setTimeout(r, 1000));

    // Try each selector
    for (const selector of YT_SELECTORS.TRANSCRIPT_SELECTORS) {
      try {
        const segments = document.querySelectorAll(selector);
        if (segments.length > 0) {
          const text = Array.from(segments)
            .map(el => el.textContent.trim())
            .filter(t => t.length > 0)
            .join(' ')
            .replace(/\[\d+:\d+\]/g, '')     // Remove timestamps like [1:23]
            .replace(/\d+:\d+/g, '')          // Remove timestamps like 1:23
            .replace(/\s+/g, ' ')
            .trim();

          if (text.length > 0) {
            console.log(`PYICE: Page transcript extracted: ${text.length} chars`);
            return text;
          }
        }
      } catch (e) {
        // Skip invalid selector
      }
    }

    return '';
  }

  /**
   * Attempt to click the "Show transcript" button to open the transcript panel.
   */
  async _tryOpenTranscript() {
    for (const selector of YT_SELECTORS.TRANSCRIPT_BUTTON_SELECTORS) {
      try {
        const btn = document.querySelector(selector);
        if (btn) {
          btn.click();
          await new Promise(r => setTimeout(r, 500));
          return;
        }
      } catch (e) {
        // Skip
      }
    }
  }

  // ── Method 3: Live Caption Observer ──────────────────────────────────────

  /**
   * Start observing live captions via MutationObserver.
   *
   * @param {function} onUpdate - Called with current accumulated text on each change
   * @param {number} [autoStopChars] - Auto-stop after this many chars
   */
  startCaptionObserver(onUpdate, autoStopChars = CONTENT_THRESHOLDS.CAPTION_AUTO_STOP_CHARS) {
    if (this.captionObserver) {
      this.captionObserver.disconnect();
    }

    this.isCollecting = true;
    const lastCaption = { text: '' };

    this.captionObserver = new MutationObserver(() => {
      const captionElements = document.querySelectorAll(YT_SELECTORS.CAPTION_SEGMENT);

      captionElements.forEach(element => {
        const text = element.textContent.trim();
        if (text && text !== lastCaption.text) {
          lastCaption.text = text;
          this.captionText += ' ' + text;

          if (onUpdate) {
            onUpdate(this.captionText);
          }

          // Auto-stop
          if (this.captionText.length >= autoStopChars) {
            this.stopCaptionObserver();
          }
        }
      });
    });

    // Observe the entire body for caption changes (YouTube injects captions dynamically)
    this.captionObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log('PYICE: Caption observer started');
  }

  /**
   * Stop the live caption observer.
   */
  stopCaptionObserver() {
    if (this.captionObserver) {
      this.captionObserver.disconnect();
      this.captionObserver = null;
    }
    if (this._captionCheckInterval) {
      clearInterval(this._captionCheckInterval);
      this._captionCheckInterval = null;
    }
    this.isCollecting = false;
    console.log('PYICE: Caption observer stopped');
  }

  // ── Accessors ────────────────────────────────────────────────────────────

  /**
   * Get the accumulated text content.
   * @returns {string}
   */
  getText() {
    return this.captionText.trim();
  }

  /**
   * Set text content directly (e.g. from manual input).
   * @param {string} text
   */
  setText(text) {
    this.captionText = text;
  }

  /**
   * Reset accumulated text and stop any observers.
   */
  reset() {
    this.captionText = '';
    this.stopCaptionObserver();
  }
}

console.log('📋 PYICE content extractor loaded');
