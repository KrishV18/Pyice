/**
 * PYICE Content Extractor
 * Unified content extraction pipeline for YouTube videos.
 * Shared by both quiz and notes generators.
 *
 * Priority:
 *   1. ytInitialPlayerResponse captionTracks (most reliable, no API key)
 *   2. Page Transcript Panel DOM (if panel already open)
 *   3. Auto-open Transcript Panel → scrape DOM
 *   4. Live Captions MutationObserver
 *   5. Manual text input fallback
 */

class ContentExtractor {
  constructor() {
    this.captionText = '';
    this.isCollecting = false;
    this.captionObserver = null;
    this._captionCheckInterval = null;
  }

  // ── Video ID ─────────────────────────────────────────────────────────────

  getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v') || null;
  }

  // ── Full Extraction Pipeline ─────────────────────────────────────────────

  async extractContent(callbacks, minChars = CONTENT_THRESHOLDS.MIN_QUIZ_CHARS) {
    const { onStatus, onSuccess, onFallbackToManual } = callbacks;

    // ── Method 1: ytInitialPlayerResponse (most reliable) ──────────────────
    onStatus('🔍 Extracting transcript from video data...');
    try {
      const apiText = await this.fetchFromPlayerResponse();
      if (apiText && apiText.trim().length >= minChars) {
        this.captionText = apiText;
        onStatus('✅ Transcript extracted successfully!');
        onSuccess(this.captionText);
        return;
      }
    } catch (err) {
      console.warn('PYICE: playerResponse extraction failed:', err);
    }

    // ── Method 2: Transcript panel already open in DOM ─────────────────────
    onStatus('🔍 Checking for open transcript panel...');
    try {
      const domText = this.scrapeTranscriptPanel();
      if (domText && domText.trim().length >= minChars) {
        this.captionText = domText;
        onStatus('✅ Transcript extracted from page!');
        onSuccess(this.captionText);
        return;
      }
    } catch (err) {
      console.warn('PYICE: DOM transcript scrape failed:', err);
    }

    // ── Method 3: Auto-open transcript panel then scrape ───────────────────
    onStatus('📂 Opening transcript panel...');
    const opened = await this.openTranscriptPanel();
    if (opened) {
      await new Promise(r => setTimeout(r, 2000)); // Wait for panel to render
      try {
        const domText = this.scrapeTranscriptPanel();
        if (domText && domText.trim().length >= minChars) {
          this.captionText = domText;
          onStatus('✅ Transcript extracted from panel!');
          onSuccess(this.captionText);
          return;
        }
      } catch (err) {
        console.warn('PYICE: Post-open DOM scrape failed:', err);
      }
    }

    // ── Method 4: Live caption observer ────────────────────────────────────
    onStatus('🎧 Collecting live captions — make sure captions are ON and play the video...');
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

    // 60-second safety timeout → manual fallback
    setTimeout(() => {
      if (this.isCollecting && this.captionText.length < minChars) {
        this.stopCaptionObserver();
        onFallbackToManual();
      }
    }, 60000);
  }

  // ── Method 1: ytInitialPlayerResponse ────────────────────────────────────

  /**
   * Read captionTracks from the page's ytInitialPlayerResponse global,
   * then fetch the actual timed-text via ?fmt=json3.
   * This works on any video with captions — no API key required.
   */
  async fetchFromPlayerResponse() {
    // ytInitialPlayerResponse is a global set by YouTube's page JS
    const playerResp = this._getPlayerResponse();
    if (!playerResp) {
      console.warn('PYICE: ytInitialPlayerResponse not found');
      return '';
    }

    const tracks = playerResp?.captions
      ?.playerCaptionsTracklistRenderer
      ?.captionTracks;

    if (!tracks || tracks.length === 0) {
      console.warn('PYICE: No captionTracks found in playerResponse');
      return '';
    }

    console.log(`PYICE: Found ${tracks.length} caption track(s):`);
    tracks.forEach((t, i) => console.log(`  [${i}] lang=${t.languageCode} name=${t.name?.simpleText || '?'}`));

    // Prefer English tracks
    const preferred = tracks.find(t =>
      t.languageCode === 'en' ||
      t.languageCode === 'en-US' ||
      t.languageCode === 'en-GB'
    ) || tracks[0]; // fallback to first available

    const baseUrl = preferred.baseUrl;
    if (!baseUrl) return '';

    // Fetch with JSON format (more stable than XML)
    const url = baseUrl.includes('fmt=') ? baseUrl : `${baseUrl}&fmt=json3`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Transcript fetch failed: ${response.status}`);

    const data = await response.json();

    // json3 format: { events: [{ segs: [{ utf8: "text" }] }] }
    const text = (data.events || [])
      .filter(e => e.segs)
      .flatMap(e => e.segs)
      .map(s => s.utf8 || '')
      .join(' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    console.log(`PYICE: Extracted ${text.length} chars from captionTracks (lang=${preferred.languageCode})`);
    return text;
  }

  /**
   * Safely access ytInitialPlayerResponse from the page.
   * It's set as a window global by YouTube's own scripts.
   */
  _getPlayerResponse() {
    try {
      // Direct window global (works in most cases when running as content script)
      if (window.ytInitialPlayerResponse &&
          window.ytInitialPlayerResponse.captions) {
        return window.ytInitialPlayerResponse;
      }

      // Fallback: extract from page source via script tags
      const scripts = document.querySelectorAll('script:not([src])');
      for (const script of scripts) {
        const content = script.textContent;
        if (content && content.includes('ytInitialPlayerResponse')) {
          const match = content.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})(?:;|\n|var |window\.)/s);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              if (parsed.captions) return parsed;
            } catch (e) {
              // malformed JSON, skip
            }
          }
        }
      }
    } catch (e) {
      console.warn('PYICE: Could not access ytInitialPlayerResponse:', e);
    }
    return null;
  }

  // ── Method 2 & 3: Transcript Panel DOM ───────────────────────────────────

  /**
   * Scrape text from the YouTube transcript panel when it's open in the DOM.
   * Targets the engagement panel that YouTube renders for transcripts.
   */
  scrapeTranscriptPanel() {
    // Primary: engagement panel container (current YouTube 2025 structure)
    const panelSelectors = [
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]',
      'ytd-transcript-renderer',
    ];

    // Segment text selectors inside the panel
    const segmentSelectors = [
      'ytd-transcript-segment-renderer .segment-text',
      'ytd-transcript-segment-view-model .segment-text',
      '.segment-text',
    ];

    for (const panelSel of panelSelectors) {
      try {
        const panel = document.querySelector(panelSel);
        if (!panel) continue;

        for (const segSel of segmentSelectors) {
          const segments = panel.querySelectorAll(segSel);
          if (segments.length > 0) {
            const text = Array.from(segments)
              .map(el => el.textContent.trim())
              .filter(t => t.length > 0)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();

            if (text.length > 0) {
              console.log(`PYICE: Panel transcript scraped: ${text.length} chars`);
              return text;
            }
          }
        }
      } catch (e) {
        // skip invalid selector
      }
    }

    return '';
  }

  /**
   * Try to open the YouTube transcript panel.
   * Returns true if a button was found and clicked.
   *
   * YouTube places the "Show transcript" option:
   *   - In the "..." overflow menu under the video (below the title)
   *   - Or as a direct button inside ytd-video-description-transcript-section-renderer
   */
  async openTranscriptPanel() {
    // Strategy A: Direct transcript button (sometimes present without needing overflow menu)
    const directSelectors = [
      // 2025 YouTube: button inside transcript section component
      'ytd-video-description-transcript-section-renderer button',
      // aria-label based
      'button[aria-label="Show transcript"]',
      'tp-yt-paper-button[aria-label="Show transcript"]',
    ];

    for (const sel of directSelectors) {
      try {
        const btn = document.querySelector(sel);
        if (btn) {
          console.log(`PYICE: Clicking transcript button via: ${sel}`);
          btn.click();
          await new Promise(r => setTimeout(r, 500));
          return true;
        }
      } catch (e) { /* skip */ }
    }

    // Strategy B: Open the "..." menu, then click "Show transcript"
    const menuOpened = await this._openOverflowMenu();
    if (menuOpened) {
      await new Promise(r => setTimeout(r, 500));

      // Look for transcript option in the menu
      const menuItems = document.querySelectorAll(
        'ytd-menu-service-item-renderer yt-formatted-string, tp-yt-paper-item yt-formatted-string, ytd-menu-navigation-item-renderer yt-formatted-string'
      );

      for (const item of menuItems) {
        const text = item.textContent.trim().toLowerCase();
        if (text.includes('transcript') || text.includes('transcript')) {
          console.log('PYICE: Found transcript menu item, clicking...');
          item.closest('ytd-menu-service-item-renderer, tp-yt-paper-item, ytd-menu-navigation-item-renderer')?.click();
          await new Promise(r => setTimeout(r, 300));
          return true;
        }
      }
    }

    console.warn('PYICE: Could not open transcript panel');
    return false;
  }

  /**
   * Click the "..." overflow/more options button below the video.
   */
  async _openOverflowMenu() {
    const menuButtonSelectors = [
      // The three-dot menu on the video actions row
      '#info ytd-menu-renderer button',
      'ytd-menu-renderer.ytd-video-primary-info-renderer button[aria-label="More actions"]',
      '#actions ytd-button-renderer:last-child button',
      'ytd-segmented-like-dislike-button-renderer ~ ytd-menu-renderer button',
    ];

    for (const sel of menuButtonSelectors) {
      try {
        const btn = document.querySelector(sel);
        if (btn) {
          console.log(`PYICE: Opening overflow menu via: ${sel}`);
          btn.click();
          await new Promise(r => setTimeout(r, 400));
          return true;
        }
      } catch (e) { /* skip */ }
    }

    return false;
  }

  // ── Method 4: Live Caption Observer ──────────────────────────────────────

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

          if (onUpdate) onUpdate(this.captionText);

          if (this.captionText.length >= autoStopChars) {
            this.stopCaptionObserver();
          }
        }
      });
    });

    this.captionObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log('PYICE: Live caption observer started');
  }

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

  getText() { return this.captionText.trim(); }
  setText(text) { this.captionText = text; }
  reset() { this.captionText = ''; this.stopCaptionObserver(); }
}

console.log('📋 PYICE content extractor loaded');
