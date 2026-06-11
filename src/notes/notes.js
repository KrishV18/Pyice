/**
 * PYICE Notes Generator Module
 * Generates AI-powered visual study notes from YouTube video content.
 *
 * Dependencies: constants.js, storage.js, ai-client.js, content-extractor.js, language.js
 */

class YouTubeNotesGenerator {
  constructor() {
    this.contentExtractor = new ContentExtractor();
    this.currentNotes = null;
    this.uiContainer = null;
    this.loadingInterval = null;
  }

  init() {
    // No-op; styles now loaded via manifest CSS
  }

  // ── UI Creation ──────────────────────────────────────────────────────────

  createNotesUI() {
    const existing = document.getElementById('notes-generator-ui');
    if (existing) existing.remove();

    this.uiContainer = document.createElement('div');
    this.uiContainer.id = 'notes-generator-ui';
    this.uiContainer.className = 'notes-ui-container';

    this.uiContainer.innerHTML = `
      <div class="notes-ui-header">
        <h3>📝 Smart Notes</h3>
        <button class="notes-ui-close" id="notes-close-btn">×</button>
      </div>
      
      <div class="notes-ui-content">
        <div class="notes-status" id="notes-status">
          Ready to generate notes from video content!
        </div>
        
        <div class="notes-start-section" id="notes-start-section">
          <button class="notes-btn" id="generate-notes">
            📚 Generate Study Notes
          </button>
        </div>
        
        <div class="notes-collection" id="notes-collection" style="display: none;">
          <div class="collection-info">
            <span id="notes-collection-status">Collecting content...</span>
            <button class="action-btn" id="stop-notes-collection">Generate</button>
          </div>
          <div class="collected-preview" id="notes-collected-preview"></div>
        </div>
        
        <div class="notes-display" id="notes-display" style="display: none;">
          <div id="notes-content"></div>
          <div class="notes-actions">
            <button class="action-btn" id="view-pdf">📄 View as PDF</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.uiContainer);
    this.addNotesEventListeners();
  }

  addNotesEventListeners() {
    document.getElementById('notes-close-btn')?.addEventListener('click', () => {
      this.uiContainer.style.display = 'none';
    });

    document.getElementById('generate-notes')?.addEventListener('click', () => {
      this.autoDetectAndGenerateNotes();
    });

    document.getElementById('stop-notes-collection')?.addEventListener('click', () => {
      this.stopCollectionAndGenerateNotes();
    });

    document.getElementById('view-pdf')?.addEventListener('click', () => {
      this.viewAsPDF();
    });
  }

  // ── Content Extraction (delegates to shared ContentExtractor) ────────────

  async autoDetectAndGenerateNotes() {
    document.getElementById('notes-start-section').style.display = 'none';
    const statusEl = document.getElementById('notes-status');

    this.contentExtractor.extractContent({
      onStatus: (msg) => { statusEl.textContent = msg; },
      onSuccess: async (text) => {
        this.contentExtractor.setText(text);
        await this.generateNotes();
      },
      onFallbackToManual: () => {
        this.showNotesError('No content source available. Please enable captions or transcript manually.');
      }
    }, CONTENT_THRESHOLDS.MIN_NOTES_CHARS);
  }

  async stopCollectionAndGenerateNotes() {
    this.contentExtractor.stopCaptionObserver();

    if (this.contentExtractor.getText().length < CONTENT_THRESHOLDS.MIN_NOTES_CHARS) {
      this.showNotesError('Not enough text collected. Please watch more of the video.');
      return;
    }

    await this.generateNotes();
  }

  // ── Notes Generation ─────────────────────────────────────────────────────

  async generateNotes() {
    document.getElementById('notes-collection').style.display = 'none';
    document.getElementById('notes-start-section').style.display = 'none';

    const notesDisplay = document.getElementById('notes-display');
    const notesContent = document.getElementById('notes-content');

    notesDisplay.style.display = 'block';
    notesContent.innerHTML = '<div class="loading-notes">📝 Generating comprehensive study notes...</div>';
    this.showEngagingLoader();

    try {
      let captionText = this.contentExtractor.getText();
      if (!captionText || captionText.trim().length < CONTENT_THRESHOLDS.MIN_NOTES_CHARS) {
        throw new Error('Not enough content to generate notes');
      }

      // Language detection & translation
      const { text: englishText } = await ensureEnglish(captionText, (msg) => {
        document.getElementById('notes-status').innerHTML = `<div class="language-info">${msg}</div>`;
      });
      this.contentExtractor.setText(englishText);

      const notes = await this.createAIStudyNotes();
      if (!notes || typeof notes !== 'object') throw new Error('Invalid notes generated');

      this.currentNotes = notes;
      this.displayNotes(notes);
      document.getElementById('notes-status').innerHTML = '<div class="success-notes">✅ Notes generated successfully!</div>';

    } catch (error) {
      console.error('Notes generation failed:', error);
      try {
        const localNotes = this.createLocalStudyNotes();
        this.currentNotes = localNotes;
        this.displayNotes(localNotes);
        document.getElementById('notes-status').innerHTML = '<div class="success-notes">✅ Notes generated using offline mode!</div>';
      } catch (fallbackError) {
        notesContent.innerHTML = '<div class="error-notes">❌ Failed to generate notes. Please refresh and try again.</div>';
      }
    }
  }

  // ── AI Notes Generation ──────────────────────────────────────────────────

  async createAIStudyNotes() {
    const captionText = this.contentExtractor.getText();

    const prompt = `You are an expert visual educator and diagram creator.
Generate study notes that are 75% VISUALS and only 25% text.
The notes should be designed such that they can be printed as a PDF and used for study.

CRITICAL VISUAL REQUIREMENTS:
- Generate 8-12 visuals minimum for comprehensive coverage
- Each major topic MUST have 2-3 different visual representations
- Create detailed SVG diagrams, flowcharts, concept maps, and process diagrams

VISUAL TYPES TO CREATE:
1. Main concept overview diagram (SVG mindmap)
2. Detailed process flowcharts for each topic (SVG)
3. Comparison charts/tables (SVG)
4. Timeline diagrams if applicable (SVG)
5. Hierarchical structure diagrams (SVG)
6. Data visualization charts (SVG)
7. Summary infographics (SVG)

JSON Structure:
{
  "title": "[Topic]",
  "primaryVisuals": [
    {
      "type": "mindmap",
      "title": "Complete Topic Overview",
      "description": "Deep explanation of concepts",
      "svg": "<svg viewBox='0 0 500 400'>...</svg>",
      "detailedExplanation": "What this visual teaches"
    }
  ],
  "topicVisuals": [
    {
      "topicName": "First Major Topic",
      "visuals": [
        {
          "type": "diagram",
          "title": "Topic 1 - Core Concepts",
          "svg": "<svg viewBox='0 0 500 400'>...</svg>",
          "explanation": "detailed overview"
        },
        {
          "type": "image",
          "title": "Topic 1 - Application",
          "imageUrl": "https://via.placeholder.com/500x350/1a73e8/ffffff?text=Topic_1",
          "explanation": "How this applies"
        }
      ]
    }
  ],
  "Summary": "Bullet point summary of key concepts"
}

CONTENT TO ANALYZE:
${captionText.substring(0, CONTENT_THRESHOLDS.MAX_CONTENT_FOR_API)}`;

    try {
      const notes = await GeminiClient.generateContent(prompt, {
        model: GEMINI_MODELS.NOTES,
        maxOutputTokens: API_DEFAULTS.NOTES_MAX_TOKENS,
        temperature: API_DEFAULTS.NOTES_TEMPERATURE,
        topK: API_DEFAULTS.NOTES_TOP_K,
        topP: API_DEFAULTS.NOTES_TOP_P,
        timeoutMs: API_DEFAULTS.TIMEOUT_MS
      });
      return notes;
    } catch (error) {
      if (error instanceof ApiKeyMissingError) {
        document.getElementById('notes-status').innerHTML =
          '<div class="error-notes">⚙️ Please set your Gemini API key in the PYICE extension popup.</div>';
      } else if (error instanceof ApiTimeoutError) {
        document.getElementById('notes-status').innerHTML =
          '<div class="error-notes">⏰ Request timed out. Using local generation...</div>';
      }
      console.warn('AI notes failed, using local fallback:', error.message);
      return this.createLocalStudyNotes();
    }
  }

  // ── Local Fallback Notes ─────────────────────────────────────────────────

  createLocalStudyNotes() {
    const text = this.contentExtractor.getText();
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const topics = text.split(/\n\n|\.\s+/).filter(p => p.trim().length > 100);

    return {
      title: 'Visual Study Guide - Complete Analysis',
      primaryVisuals: [{
        type: 'mindmap',
        title: 'Complete Topic Overview',
        svg: this.generateComprehensiveMindMap(topics),
        detailedExplanation: 'This mind map shows the interconnection of all major topics discussed.'
      }],
      topicVisuals: topics.slice(0, 6).map((topic, index) => ({
        topicName: `Key Topic ${index + 1}`,
        visuals: [
          {
            type: 'diagram',
            title: `Topic ${index + 1} - Structure`,
            svg: this.generateTopicDiagram(topic, index),
            explanation: `Breakdown of topic ${index + 1} with core concepts and applications.`
          },
          {
            type: 'image',
            title: `Topic ${index + 1} - Application`,
            imageUrl: `https://via.placeholder.com/500x350/1a73e8/ffffff?text=Topic_${index + 1}`,
            explanation: `Visual representation of topic ${index + 1} in real-world scenarios.`
          }
        ]
      })),
      Summary: `Key insights: ${sentences.slice(0, 2).join(' ')}`
    };
  }

  // ── SVG Generators ───────────────────────────────────────────────────────

  generateComprehensiveMindMap(topics) {
    const colors = SVG_COLORS.MINDMAP;
    const w = 400, h = 300, cx = w / 2, cy = h / 2;
    let svg = `<svg width="100%" height="auto" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">`;
    svg += `<rect width="${w}" height="${h}" fill="#fefefe" stroke="#2196f3" stroke-width="3" rx="15"/>`;
    svg += `<ellipse cx="${cx}" cy="${cy}" rx="100" ry="60" fill="${colors[0]}" opacity="0.8" stroke="${colors[0]}" stroke-width="4"/>`;
    svg += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="18" font-weight="bold" fill="white" font-family="Arial, sans-serif">MAIN CONCEPTS</text>`;

    const positions = [
      { x: cx - 200, y: cy - 150 }, { x: cx + 200, y: cy - 150 },
      { x: cx - 250, y: cy }, { x: cx + 250, y: cy },
      { x: cx - 200, y: cy + 150 }, { x: cx + 200, y: cy + 150 }
    ];

    topics.slice(0, 6).forEach((_, i) => {
      const p = positions[i], c = colors[(i + 1) % colors.length];
      svg += `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="${c}" stroke-width="4" opacity="0.7"/>`;
      svg += `<ellipse cx="${p.x}" cy="${p.y}" rx="90" ry="50" fill="${c}" opacity="0.8" stroke="${c}" stroke-width="3"/>`;
      svg += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-size="14" fill="white" font-family="Arial, sans-serif" font-weight="bold">Topic ${i + 1}</text>`;
    });

    svg += '</svg>';
    return svg;
  }

  generateTopicDiagram(topic, index) {
    const colors = SVG_COLORS.TOPIC;
    const w = 380, h = 280;
    let svg = `<svg width="100%" height="auto" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">`;
    svg += `<rect width="${w}" height="${h}" fill="white" stroke="#2196f3" stroke-width="3" rx="12"/>`;
    svg += `<rect x="20" y="20" width="${w - 40}" height="60" fill="${colors[index % colors.length]}" opacity="0.9" rx="10"/>`;
    svg += `<text x="${w / 2}" y="55" text-anchor="middle" dominant-baseline="central" font-size="22" font-weight="bold" fill="white" font-family="Arial, sans-serif">TOPIC ${index + 1}</text>`;

    const boxes = [
      { x: 30, y: 100, w: 150, h: 70, title: 'Key Concept', color: colors[0] },
      { x: 200, y: 100, w: 150, h: 70, title: 'Application', color: colors[1] },
      { x: 30, y: 190, w: 150, h: 70, title: 'Process', color: colors[2] },
      { x: 200, y: 190, w: 150, h: 70, title: 'Result', color: colors[3] }
    ];

    boxes.forEach((b, i) => {
      svg += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${b.color}" opacity="0.3" stroke="${b.color}" stroke-width="2" rx="8"/>`;
      svg += `<text x="${b.x + b.w / 2}" y="${b.y + 25}" text-anchor="middle" font-size="14" font-weight="bold" fill="${b.color}" font-family="Arial, sans-serif">${b.title}</text>`;
      svg += `<text x="${b.x + b.w / 2}" y="${b.y + 48}" text-anchor="middle" font-size="11" fill="#2c3e50" font-family="Arial, sans-serif">Content ${i + 1}</text>`;
    });

    svg += '</svg>';
    return svg;
  }

  generateHandDrawnDiagram(title, concepts) {
    const colors = SVG_COLORS.HANDDRAWN;
    let svg = `<svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial,sans-serif;">`;
    svg += `<rect width="400" height="300" fill="#fefefe" stroke="#ddd" stroke-width="2" rx="10"/>`;
    svg += `<ellipse cx="200" cy="150" rx="70" ry="40" fill="${colors[0]}" opacity="0.3" stroke="${colors[0]}" stroke-width="2"/>`;
    const t = (title || 'Main Topic').substring(0, 20);
    svg += `<text x="200" y="150" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="bold" fill="#2d5aa0">${t}</text>`;

    const positions = [{ x: 90, y: 90, r: 35 }, { x: 310, y: 90, r: 35 }, { x: 90, y: 210, r: 35 }, { x: 310, y: 210, r: 35 }];
    (concepts || ['Concept 1', 'Concept 2', 'Concept 3', 'Concept 4']).slice(0, 4).forEach((concept, i) => {
      const p = positions[i], c = colors[(i + 1) % colors.length];
      svg += `<line x1="200" y1="150" x2="${p.x}" y2="${p.y}" stroke="${c}" stroke-width="2" opacity="0.6"/>`;
      svg += `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${c}" opacity="0.3" stroke="${c}" stroke-width="2"/>`;
      const ct = (typeof concept === 'object' ? concept.term : concept).toString().substring(0, 8);
      svg += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-size="9" fill="#2c3e50" font-weight="600">${ct}</text>`;
    });

    svg += '</svg>';
    return svg;
  }

  // ── Notes Display ────────────────────────────────────────────────────────

  displayNotes(notes) {
    if (this.loadingInterval) { clearInterval(this.loadingInterval); this.loadingInterval = null; }

    const notesContent = document.getElementById('notes-content');
    let html = `
      <div class="notes-header-section">
        <div class="notes-title">${notes.title || 'Visual Study Guide'}</div>
        <div class="notes-subtitle">SMART NOTES</div>
      </div>`;

    // Primary visuals
    if (notes.primaryVisuals && notes.primaryVisuals.length > 0) {
      html += '<div class="visual-section-title">🎯 Core Concept Overview</div>';
      notes.primaryVisuals.forEach(visual => {
        html += `
          <div class="enhanced-visual-block">
            <div class="visual-title">${visual.title}</div>
            <div class="svg-visual-container">${visual.svg || this.generateComprehensiveMindMap(['Topic 1', 'Topic 2', 'Topic 3'])}</div>
            <div class="visual-explanation"><strong>Explanation:</strong> ${visual.detailedExplanation || 'Key concepts and their relationships.'}</div>
          </div>`;
      });
    }

    // Topic visuals
    if (notes.topicVisuals && notes.topicVisuals.length > 0) {
      notes.topicVisuals.forEach((topicGroup, idx) => {
        html += `<div class="topic-header">${topicGroup.topicName || `Topic ${idx + 1}`}</div>`;
        topicGroup.visuals.forEach(visual => {
          html += '<div class="enhanced-visual-block">';
          html += `<div class="visual-title">${visual.title}</div>`;
          if (visual.svg) html += `<div class="svg-visual-container">${visual.svg}</div>`;
          if (visual.imageUrl) {
            html += `<div class="multi-source-image" data-urls='["${visual.imageUrl}"]' data-title="${visual.title}"><div class="image-loading">Loading visual...</div></div>`;
          }
          html += `<div class="visual-explanation"><strong>Key Points:</strong> ${visual.explanation || 'Educational content.'}</div></div>`;
        });
      });
    }

    // Summary
    html += `
      <div class="text-section-title">📝 Summary</div>
      <div class="summary-content">${notes.Summary || notes.minimalTextSummary || notes.textSummary || 'Key learning objectives covered above.'}</div>
      <div class="notes-actions">
        <button class="action-btn" id="view-pdf-btn">📄 View as PDF</button>
      </div>`;

    notesContent.innerHTML = html;

    setTimeout(() => {
      document.getElementById('view-pdf-btn')?.addEventListener('click', () => this.viewAsPDF());
    }, 100);

    this.initializeEnhancedImageLoading();
  }

  // ── Image Loading ────────────────────────────────────────────────────────

  initializeEnhancedImageLoading() {
    setTimeout(() => {
      document.querySelectorAll('.multi-source-image').forEach(container => {
        const urls = JSON.parse(container.dataset.urls || '[]');
        const title = container.dataset.title || 'Visual Content';

        container.innerHTML = `
          <div class="enhanced-fallback" style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:25px;border-radius:12px;text-align:center;min-height:150px;display:flex;align-items:center;justify-content:center;width:100%;box-sizing:border-box;">
            <div><div style="font-size:40px;margin-bottom:10px;">📊</div><div style="font-size:16px;font-weight:bold;margin-bottom:8px;">${title}</div><div style="font-size:12px;opacity:0.9;">Educational Visual</div></div>
          </div>`;

        if (urls.length > 0) {
          const img = new Image();
          img.onload = () => {
            container.innerHTML = `<img src="${urls[0]}" alt="${title}" style="width:100%;max-width:500px;height:auto;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);">`;
          };
          img.onerror = () => { /* Keep fallback */ };
          img.src = urls[0];
        }
      });
    }, 100);
  }

  // ── Engaging Loader ──────────────────────────────────────────────────────

  showEngagingLoader() {
    const content = {
      facts: [
        "🧠 Your brain processes visual information 60,000x faster than text!",
        "📚 Active recall improves memory retention by up to 150%",
        "🎯 Spaced repetition can increase learning efficiency by 200%",
        "💡 Teaching others is one of the most effective learning methods",
        "🌟 Handwritten notes improve comprehension by 23%",
        "🎨 Color coding can improve memory recall by 40%"
      ],
      quotes: [
        '💫 "The more that you read, the more things you will know" - Dr. Seuss',
        '🚀 "Learning is not attained by chance" - Abigail Adams',
        '🌱 "Live as if you were to die tomorrow. Learn as if you were to live forever" - Gandhi',
        '🎯 "The expert in anything was once a beginner" - Helen Hayes'
      ],
      tips: [
        "💡 Pro Tip: Use the 25-5 rule - study for 25 minutes, break for 5!",
        "🎯 Study Hack: Explain concepts out loud to boost understanding",
        "⚡ Memory Trick: Create acronyms for lists and sequences",
        "🔄 Learning Tip: Review material within 24 hours for better retention"
      ]
    };

    const animations = ['🌊', '✨', '🔄', '⚡', '🌟', '💫', '🎯', '🚀'];
    let catIndex = 0;
    let itemIndex = 0;
    const categories = Object.keys(content);

    const update = () => {
      const cat = categories[catIndex];
      const items = content[cat];
      const anim = animations[Math.floor(Math.random() * animations.length)];
      const el = document.querySelector('.loading-notes');
      if (el) {
        el.innerHTML = `
          <div style="animation:fadeInOut 0.5s ease-in-out;">
            <div style="font-size:32px;margin-bottom:15px;">${anim}</div>
            <div style="font-size:16px;line-height:1.6;color:#667eea;max-width:350px;margin:0 auto;">${items[itemIndex]}</div>
            <div style="margin-top:15px;font-size:12px;opacity:0.7;">Generating your smart notes...</div>
          </div>`;
      }
      itemIndex++;
      if (itemIndex >= items.length) { itemIndex = 0; catIndex = (catIndex + 1) % categories.length; }
    };

    if (!document.getElementById('loader-animations')) {
      const s = document.createElement('style');
      s.id = 'loader-animations';
      s.textContent = `@keyframes fadeInOut { 0% { opacity:0;transform:translateY(10px); } 100% { opacity:1;transform:translateY(0); } } .loading-notes { text-align:center!important;padding:40px 20px!important; }`;
      document.head.appendChild(s);
    }

    update();
    this.loadingInterval = setInterval(update, 2500);
  }

  // ── PDF Export ───────────────────────────────────────────────────────────

  viewAsPDF() {
    if (!this.currentNotes) { alert('No notes to view!'); return; }
    const html = this.generateCleanHTML();
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  }

  generateCleanHTML() {
    const el = document.getElementById('notes-content');
    if (!el) return '<html><body><p>No notes available</p></body></html>';

    const clone = el.cloneNode(true);
    const notesStyles = document.getElementById('notes-generator-styles')?.textContent || '';
    const title = this.currentNotes?.title || 'Study Notes';

    return `<!DOCTYPE html>
<html><head><title>${title}</title><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&family=Caveat:wght@400;500;600;700&family=Indie+Flower&display=swap" rel="stylesheet">
<style>
${notesStyles}
body { font-family: 'Kalam', cursive; margin: 0; padding: 20px; background: #fefbf3; }
.notes-ui-container { position: static!important; width: 100%!important; max-width: none!important; max-height: none!important; }
svg, img { max-width: 100%!important; page-break-inside: avoid; }
.pdf-download-btn { position: fixed; top: 20px; right: 20px; padding: 12px 24px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; z-index: 1000; }
.pdf-download-btn:hover { background: #218838; }
@media print { .pdf-download-btn { display: none!important; } body { background: white; } }
</style></head><body>
<button class="pdf-download-btn" onclick="window.print()">📥 Download as PDF</button>
${clone.outerHTML}
<footer style="text-align:center;margin-top:40px;color:#999;font-size:12px;">Generated by PYICE Notes Generator - ${new Date().toLocaleDateString()}</footer>
</body></html>`;
  }

  fallbackTextDownload() {
    try {
      const content = `PYICE STUDY NOTES\n================\nTitle: ${this.currentNotes?.title || 'Study Notes'}\nGenerated: ${new Date().toLocaleDateString()}\n\nSUMMARY:\n${this.currentNotes?.Summary || 'No summary available'}\n\n---\nGenerated by PYICE Notes Generator`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `PYICE_Notes_${Date.now()}.txt`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Fallback download failed:', e);
    }
  }

  // ── Reset & Utility ──────────────────────────────────────────────────────

  resetNotesUI() {
    this.contentExtractor.reset();
    this.currentNotes = null;
    document.getElementById('notes-start-section').style.display = 'block';
    document.getElementById('notes-collection').style.display = 'none';
    document.getElementById('notes-display').style.display = 'none';
    document.getElementById('notes-status').textContent = 'Ready to generate notes from video content!';
  }

  showNotesError(message) {
    document.getElementById('notes-status').innerHTML = `<div class="error-notes">❌ ${message}</div>`;
    document.getElementById('notes-start-section').style.display = 'block';
    document.getElementById('notes-collection').style.display = 'none';
    this.contentExtractor.stopCaptionObserver();
  }

  showNotesUI() {
    this.createNotesUI();
    this.uiContainer.style.display = 'block';
  }

  hideNotesUI() {
    if (this.uiContainer) this.uiContainer.style.display = 'none';
  }
}

console.log('📝 PYICE Notes Generator module loaded');
