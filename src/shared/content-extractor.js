/**
 * PYICE Content Extractor
 * Unified content extraction pipeline for YouTube videos.
 * Shared by both quiz and notes generators.
 *
 * Priority:
 *   1. ytInitialPlayerResponse captionTracks (fastest, most reliable)
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

    // ── Method 1: ytInitialPlayerResponse (fastest, works on almost every video) ──
    onStatus('🔍 Extracting transcript from video data...');
    try {
      const apiText = await this.fetchFromPlayerResponse();
      if (apiText && apiText.trim().length >= minChars) {
        this.captionText = apiText;
        onStatus('✅ Transcript extracted successfully!');
        
        // Heatmap generation
        if (window.initHeatmap && this.transcriptData) {
          const video = document.querySelector('video');
          const waitForDuration = () => {
            if (video && video.duration && video.duration > 0) {
              window.initHeatmap(this.transcriptData, video.duration);
            } else if (video) {
              video.addEventListener('loadedmetadata', () => {
                window.initHeatmap(this.transcriptData, video.duration);
              }, { once: true });
            }
          };
          waitForDuration();
        }

        onSuccess(this.captionText);
        return;
      }
    } catch (err) {
      console.warn('PYICE: playerResponse extraction failed:', err);
    }

    // ── Method 2: Transcript panel already open ────────────────────────────
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

    // ── Method 3: Auto-open transcript panel then scrape ──────────────────
    onStatus('📂 Opening transcript panel...');
    const opened = await this.openTranscriptPanel();
    if (opened) {
      await new Promise(r => setTimeout(r, 2000));
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

    // ── Method 4: Live caption observer ───────────────────────────────────
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
   * then fetch the actual timed-text via &fmt=json3.
   * This works on any video with captions — no API key required.
   */
  async fetchFromPlayerResponse() {
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

    // Prefer English; fall back to first available
    const preferred = tracks.find(t =>
      t.languageCode === 'en' ||
      t.languageCode === 'en-US' ||
      t.languageCode === 'en-GB'
    ) || tracks[0];

    const baseUrl = preferred.baseUrl;
    if (!baseUrl) return '';

    // Use URL object to safely force fmt=json3 — avoids broken string concatenation
    // when YouTube's baseUrl already contains a different fmt= value
    let fetchUrl = baseUrl;
    try {
      const urlObj = new URL(baseUrl);
      urlObj.searchParams.set('fmt', 'json3');
      fetchUrl = urlObj.toString();
    } catch (e) {
      fetchUrl = `${baseUrl}&fmt=json3`;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`Transcript fetch failed: ${response.status}`);

    const data = await response.json();

    // json3 format: { events: [{ tStartMs: 12500, dDurationMs: 3200, segs: [{ utf8: "text" }] }] }
    this.transcriptData = (data.events || [])
      .filter(e => e.segs)
      .map(e => ({
        text: e.segs.map(s => s.utf8 || '').join(' ').trim(),
        start: (e.tStartMs || 0) / 1000,
        duration: (e.dDurationMs || 0) / 1000
      }))
      .filter(e => e.text.length > 0);

    const text = this.transcriptData
      .map(e => e.text)
      .join(' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    console.log(`PYICE: Extracted ${text.length} chars via captionTracks (lang=${preferred.languageCode})`);
    return text;
  }

  /**
   * Safely access ytInitialPlayerResponse.
   * YouTube sets this as a global on every video page.
   */
  _getPlayerResponse() {
    try {
      if (window.ytInitialPlayerResponse?.captions) {
        return window.ytInitialPlayerResponse;
      }

      // Fallback: extract from inline <script> tags
      const scripts = document.querySelectorAll('script:not([src])');
      for (const script of scripts) {
        const content = script.textContent;
        if (content && content.includes('ytInitialPlayerResponse')) {
          const match = content.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})(?:;|\n|var |window\.)/s);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              if (parsed.captions) return parsed;
            } catch (e) { /* malformed, skip */ }
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
   */
  scrapeTranscriptPanel() {
    const panelSelectors = [
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]',
      'ytd-transcript-renderer',
    ];

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
      } catch (e) { /* skip */ }
    }

    return '';
  }

  /**
   * Try to open the YouTube transcript panel.
   * Returns true if a button was found and clicked.
   */
  async openTranscriptPanel() {
    // Strategy A: Direct transcript button
    const directSelectors = [
      'ytd-video-description-transcript-section-renderer button',
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

    // Strategy B: Open the "..." overflow menu, then click "Show transcript"
    const menuOpened = await this._openOverflowMenu();
    if (menuOpened) {
      await new Promise(r => setTimeout(r, 500));

      const menuItems = document.querySelectorAll(
        'ytd-menu-service-item-renderer yt-formatted-string, tp-yt-paper-item yt-formatted-string, ytd-menu-navigation-item-renderer yt-formatted-string'
      );

      for (const item of menuItems) {
        const text = item.textContent.trim().toLowerCase();
        if (text.includes('transcript')) {
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

  async _openOverflowMenu() {
    const menuButtonSelectors = [
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
