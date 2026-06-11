/**
 * PYICE Quiz Generator Module
 * Generates AI-powered quizzes from YouTube video content.
 *
 * Dependencies: constants.js, storage.js, ai-client.js, content-extractor.js, language.js
 */

class YouTubeQuizGenerator {
  constructor() {
    this.contentExtractor = new ContentExtractor();
    this.currentQuiz = null;
    this.userAnswers = {};
    this.quizStartTime = null;
    this.quizEndTime = null;
    this.numQuestions = 5;
    this.difficultyLevel = 'basic';
    this.uiContainer = null;

    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupExtension());
    } else {
      this.setupExtension();
    }
  }

  setupExtension() {
    this.createUI();
    this.checkAvailableOptions();
  }

  // ── UI Creation ──────────────────────────────────────────────────────────

  createUI() {
    const existing = document.getElementById('quiz-generator-ui');
    if (existing) existing.remove();

    this.uiContainer = document.createElement('div');
    this.uiContainer.id = 'quiz-generator-ui';
    this.uiContainer.className = 'quiz-ui-container';

    this.uiContainer.innerHTML = `
      <div class="quiz-ui-header">
        <h3>PYICE — QUIZ</h3>
        <button class="quiz-ui-close" id="quiz-close-btn">×</button>
      </div>
      
      <div class="quiz-ui-content">
        <div class="quiz-status" id="quiz-status">Select quiz difficulty:</div>
        
        <div class="quiz-start-section" id="quiz-start-section" style="display: none;">
          <button class="quiz-btn" id="start-quiz">🎯 Generate Quiz</button>
        </div>

        <div class="num-questions-section" id="num-questions-section" style="display: none;">
          <h4>Select Quiz Difficulty:</h4>
          <button class="quiz-btn" id="select-basic-quiz">🟢 BASIC Quiz (MCQ only)</button>
          <button class="quiz-btn" id="select-intermediate-quiz">🟡 INTERMEDIATE Quiz (MCQ + Short Answer)</button>
          <button class="quiz-btn" id="select-advanced-quiz">🔴 ADVANCED Quiz (All question types)</button>
        </div>
        
        <div class="quiz-collection" id="quiz-collection" style="display: none;">
          <div class="collection-info">
            <span id="collection-status">Ready to collect...</span>
            <button class="quiz-btn-small" id="stop-collection">Stop & Generate</button>
          </div>
          <div class="collected-preview" id="collected-preview"></div>
        </div>
        
        <div class="quiz-display" id="quiz-display" style="display: none;">
          <div class="quiz-questions" id="quiz-questions"></div>
          <div class="quiz-actions" id="quiz-actions" style="margin-top: 20px;">
            <button class="quiz-btn" id="check-answers">Check My Answers</button>
          </div>
          <div class="quiz-results" id="quiz-results"></div>
          <button class="quiz-btn" id="new-quiz" style="display: none;">Generate New Quiz</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.uiContainer);
    this.addEventListeners();
  }

  addEventListeners() {
    document.getElementById('quiz-close-btn')?.addEventListener('click', () => {
      this.uiContainer.style.display = 'none';
    });

    document.getElementById('start-quiz')?.addEventListener('click', () => {
      this.showDifficultySelector();
    });

    document.getElementById('check-answers')?.addEventListener('click', () => {
      this.checkAnswers();
    });

    document.getElementById('new-quiz')?.addEventListener('click', () => {
      this.resetUI();
    });

    document.getElementById('stop-collection')?.addEventListener('click', () => {
      this.stopCollectionAndGenerate();
    });
  }

  // ── Difficulty Selection ─────────────────────────────────────────────────

  showDifficultySelector() {
    document.getElementById('quiz-start-section').style.display = 'none';
    document.getElementById('num-questions-section').style.display = 'block';
    document.getElementById('quiz-status').textContent = 'Select quiz difficulty:';

    document.getElementById('num-questions-section').innerHTML = `
      <h4>Select Quiz Difficulty:</h4>
      <button class="quiz-btn" id="select-basic-quiz">🟢 BASIC Quiz (MCQ only)</button>
      <button class="quiz-btn" id="select-intermediate-quiz">🟡 INTERMEDIATE Quiz (MCQ + Short Answer)</button>
      <button class="quiz-btn" id="select-advanced-quiz">🔴 ADVANCED Quiz (All question types)</button>
    `;

    this.addDifficultyEventListeners();
  }

  addDifficultyEventListeners() {
    setTimeout(() => {
      document.getElementById('select-basic-quiz')?.addEventListener('click', () => {
        this.difficultyLevel = 'basic';
        this.numQuestions = DIFFICULTY_CONFIG.basic.numQuestions;
        this.autoDetectAndGenerate();
      });

      document.getElementById('select-intermediate-quiz')?.addEventListener('click', () => {
        this.difficultyLevel = 'intermediate';
        this.numQuestions = DIFFICULTY_CONFIG.intermediate.numQuestions;
        this.autoDetectAndGenerate();
      });

      document.getElementById('select-advanced-quiz')?.addEventListener('click', () => {
        this.difficultyLevel = 'advanced';
        this.numQuestions = DIFFICULTY_CONFIG.advanced.numQuestions;
        this.autoDetectAndGenerate();
      });
    }, 100);
  }

  // ── Content Extraction (delegates to shared ContentExtractor) ────────────

  async autoDetectAndGenerate() {
    document.getElementById('num-questions-section').style.display = 'none';
    const statusEl = document.getElementById('quiz-status');

    this.contentExtractor.extractContent({
      onStatus: (msg) => { statusEl.textContent = msg; },
      onSuccess: async (text) => {
        this.contentExtractor.setText(text);
        await this.generateQuiz();
      },
      onFallbackToManual: () => {
        this.showManualInputOption();
      }
    }, CONTENT_THRESHOLDS.MIN_QUIZ_CHARS);
  }

  showManualInputOption() {
    document.getElementById('quiz-status').textContent = 'No transcript available. Use manual input:';
    
    const existingManual = document.getElementById('manual-input-section');
    if (existingManual) existingManual.remove();
    
    const manualSection = document.createElement('div');
    manualSection.id = 'manual-input-section';
    manualSection.innerHTML = `
      <div style="margin: 16px 0; padding: 16px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #17a2b8;">
        <h5 style="margin: 0 0 12px 0; color: #17a2b8;">📝 Manual Content Input</h5>
        <p style="font-size: 13px; color: #666; margin-bottom: 12px;">
          Paste educational content from video description, your notes, or any study material:
        </p>
        <textarea 
          id="manual-content-input" 
          rows="8" 
          placeholder="Paste your educational content here... (minimum ${CONTENT_THRESHOLDS.MIN_QUIZ_CHARS} characters needed)"
          style="width: 100%; border: 2px solid #e0e0e0; border-radius: 8px; padding: 12px; font-size: 14px; resize: vertical; font-family: inherit; box-sizing: border-box;"
        ></textarea>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
          <span id="content-length-counter" style="font-size: 12px; color: #666;">0 characters</span>
          <button id="generate-from-manual" class="quiz-btn" style="width: auto; padding: 8px 16px;" disabled>
            Generate Quiz from Content
          </button>
        </div>
      </div>
    `;
    
    const statusEl = document.getElementById('quiz-status');
    statusEl.parentNode.insertBefore(manualSection, statusEl.nextSibling);
    
    const textarea = document.getElementById('manual-content-input');
    const counter = document.getElementById('content-length-counter');
    const generateBtn = document.getElementById('generate-from-manual');
    
    textarea.addEventListener('input', () => {
      const length = textarea.value.trim().length;
      counter.textContent = `${length} characters`;
      generateBtn.disabled = length < CONTENT_THRESHOLDS.MIN_QUIZ_CHARS;
      counter.style.color = length >= CONTENT_THRESHOLDS.MIN_QUIZ_CHARS ? '#28a745' : (length > 0 ? '#ffc107' : '#666');
    });
    
    generateBtn.addEventListener('click', () => {
      const content = textarea.value.trim();
      if (content.length >= CONTENT_THRESHOLDS.MIN_QUIZ_CHARS) {
        this.contentExtractor.setText(content);
        manualSection.style.display = 'none';
        document.getElementById('quiz-status').textContent = 'Content loaded from manual input!';
        this.generateQuiz();
      }
    });
    
    textarea.focus();
  }

  // ── Caption Collection UI ────────────────────────────────────────────────

  updateCollectionPreview() {
    const preview = document.getElementById('collected-preview');
    const text = this.contentExtractor.getText();
    const words = text.split(' ').length;
    const lastWords = text.split(' ').slice(-15).join(' ');

    preview.innerHTML = `
      <div class="preview-stats">📊 Collected: ${words} words</div>
      <div class="preview-text">...${lastWords}</div>
    `;
  }

  async stopCollectionAndGenerate() {
    this.contentExtractor.stopCaptionObserver();

    if (this.contentExtractor.getText().length < CONTENT_THRESHOLDS.MIN_QUIZ_CHARS) {
      this.showError('Not enough text collected. Please watch more of the video or use manual input.');
      return;
    }

    await this.generateQuiz();
  }

  // ── Quiz Generation ──────────────────────────────────────────────────────

  async generateQuiz() {
    document.getElementById('quiz-collection').style.display = 'none';
    document.getElementById('num-questions-section').style.display = 'none';
    document.getElementById('quiz-start-section').style.display = 'none';

    const quizDisplay = document.getElementById('quiz-display');
    const questionsContainer = document.getElementById('quiz-questions');

    quizDisplay.style.display = 'block';
    questionsContainer.innerHTML = '<div class="loading">🎯 Generating AI-powered quiz questions...</div>';

    try {
      let captionText = this.contentExtractor.getText();

      if (!captionText || captionText.trim().length < CONTENT_THRESHOLDS.MIN_QUIZ_CHARS) {
        throw new Error('Not enough content to generate quiz');
      }

      // Language detection & translation
      const { text: englishText } = await ensureEnglish(captionText, (msg) => {
        document.getElementById('quiz-status').innerHTML = `<div class="language-info">${msg}</div>`;
      });
      this.contentExtractor.setText(englishText);

      const questions = await this.createAIQuizQuestions();
      this.currentQuiz = questions;
      this.userAnswers = {};
      this.displayQuiz(questions);
      
      document.getElementById('quiz-status').textContent = '';
      
    } catch (error) {
      console.error('Quiz generation failed:', error);
      questionsContainer.innerHTML = '<div class="error">❌ Failed to generate quiz. Please try again.</div>';
      document.getElementById('quiz-status').innerHTML = '<span class="error">❌ Quiz generation failed. Please try again.</span>';
    }
  }

  // ── AI Quiz Question Generation ──────────────────────────────────────────

  async createAIQuizQuestions() {
    const captionText = this.contentExtractor.getText();
    const contentAnalysis = this.analyzeContentType(captionText);
    const numericalData = this.extractNumericalData(captionText);
    const allowedTypes = DIFFICULTY_CONFIG[this.difficultyLevel].allowedTypes;

    // Build the prompt
    const prompt = this._buildQuizPrompt(contentAnalysis, numericalData, allowedTypes, captionText);

    try {
      const questions = await GeminiClient.generateContent(prompt, {
        model: GEMINI_MODELS.QUIZ,
        maxOutputTokens: API_DEFAULTS.QUIZ_MAX_TOKENS
      });

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('No valid questions generated');
      }

      return this._validateQuestions(questions, allowedTypes);

    } catch (error) {
      if (error instanceof ApiKeyMissingError) {
        document.getElementById('quiz-status').innerHTML = 
          '<span class="error">⚙️ Please set your Gemini API key in the PYICE extension popup first.</span>';
      }
      console.warn('AI generation failed, using local fallback:', error.message);
      return this.createDifficultyBasedLocalQuiz(captionText);
    }
  }

  _buildQuizPrompt(contentAnalysis, numericalData, allowedTypes, captionText) {
    let difficultyInstructions = '';
    if (this.difficultyLevel === 'basic') {
      difficultyInstructions = `BASIC LEVEL REQUIREMENTS:
- ONLY generate "multiple-choice" questions
- Focus on basic concepts, definitions, and simple recall
- 4 clear options with one obviously correct answer
- Avoid complex calculations or deep analysis`;
    } else if (this.difficultyLevel === 'intermediate') {
      difficultyInstructions = `INTERMEDIATE LEVEL REQUIREMENTS:
- Generate: multiple-choice (60%), short-answer (30%), numerical (10%)
- Short-answer questions require 2-3 line explanations
- Include application and analysis questions`;
    } else {
      difficultyInstructions = `ADVANCED LEVEL REQUIREMENTS:
- Generate mix: multiple-choice (75%), (25%) other types
- Long-answer: Detailed explanations requiring 4-6 lines
- Derivation: Step-by-step mathematical/scientific proofs
- Chemical-equation: if chemistry content
- Include synthesis, evaluation, and creation level questions`;
    }

    return `You are an expert exam question generator. Create ${this.numQuestions} HIGH-QUALITY, EXAM-STYLE questions based on the provided educational content.

DIFFICULTY LEVEL: ${this.difficultyLevel.toUpperCase()}
ALLOWED QUESTION TYPES: ${allowedTypes.join(', ')}
CONTENT TYPE: ${contentAnalysis.subjectType.toUpperCase()}
HAS NUMERICAL PROBLEMS: ${contentAnalysis.hasNumericals ? 'YES' : 'NO'}
HAS DERIVATIONS: ${contentAnalysis.hasDerivations ? 'YES' : 'NO'}
HAS CHEMICAL EQUATIONS: ${contentAnalysis.hasChemicalEquations ? 'YES' : 'NO'}

${difficultyInstructions}

QUESTION TYPE SPECIFICATIONS:
1. "multiple-choice": 4 options, test concepts/facts/calculations
2. "short-answer": 2-3 line answers testing understanding
3. "long-answer": 4-6 line detailed explanations with examples
4. "derivation": Step-by-step mathematical/scientific proofs
5. "numerical": Calculate specific values with proper units
6. "chemical-equation": Balance chemical reactions with proper stoichiometry

Return ONLY a valid JSON array with this format:
[
  {
    "type": "one_of_allowed_types",
    "question": "Clear, exam-style question",
    "options": ["A", "B", "C", "D"],
    "correct": 0,
    "answer": "expected answer text",
    "detailedSolution": "Complete step-by-step solution",
    "difficulty": "${this.difficultyLevel}",
    "examTopic": "specific topic",
    "marks": 1
  }
]

Content: ${captionText}

${numericalData.formulas.length > 0 ? `FORMULAS: ${numericalData.formulas.slice(0, 5).join('; ')}` : ''}
${numericalData.examples.length > 0 ? `EXAMPLES: ${numericalData.examples.slice(0, 3).join('; ')}` : ''}

IMPORTANT: Only generate question types in: ${allowedTypes.join(', ')}`;
  }

  _validateQuestions(questions, allowedTypes) {
    const validated = questions.map((q, index) => {
      try {
        if (!q.difficulty) q.difficulty = this.difficultyLevel;
        if (!q.examTopic) q.examTopic = 'General Knowledge';
        if (!q.detailedSolution && q.explanation) q.detailedSolution = q.explanation;
        if (!q.detailedSolution) q.detailedSolution = 'Solution not provided';
        if (!q.marks) q.marks = MARKS_MAP[q.type] || 1;

        if (!allowedTypes.includes(q.type)) {
          q.type = 'multiple-choice';
          if (!q.options || !Array.isArray(q.options)) {
            q.options = ['Correct option', 'Incorrect A', 'Incorrect B', 'Incorrect C'];
            q.correct = 0;
          }
        }

        if (q.type === 'multiple-choice') {
          if (!q.options || !Array.isArray(q.options) || q.options.length !== 4) {
            q.options = ['Option A', 'Option B', 'Option C', 'Option D'];
          }
          if (q.correct === undefined || q.correct < 0 || q.correct > 3) q.correct = 0;
          delete q.answer;
        } else {
          if (!q.answer) q.answer = 'Answer not provided';
          delete q.options;
          delete q.correct;
        }

        if (q.type === 'numerical' && q.answer && typeof q.answer === 'string') {
          if (!/\d/.test(q.answer) && !/[+\-*/=]/.test(q.answer)) {
            q.type = 'short-answer';
            q.marks = MARKS_MAP['short-answer'];
          }
        }

        q.difficulty = this.difficultyLevel;
        return q;
      } catch (err) {
        return this._fallbackQuestion();
      }
    });

    let result = validated.filter(q => allowedTypes.includes(q.type));
    while (result.length < this.numQuestions) {
      result.push(this._fallbackQuestion());
    }
    return result.slice(0, this.numQuestions);
  }

  _fallbackQuestion() {
    return {
      type: 'multiple-choice',
      question: 'Based on the content, which statement is most accurate?',
      options: ['The content provides valuable information', 'The information is not relevant', 'No clear conclusion can be drawn', 'The content is contradictory'],
      correct: 0,
      detailedSolution: 'This question tests basic comprehension.',
      difficulty: this.difficultyLevel,
      examTopic: 'Content Comprehension',
      marks: 1
    };
  }

  // ── Content Analysis ─────────────────────────────────────────────────────

  analyzeContentType(text) {
    const lowerText = (text || this.contentExtractor.getText()).toLowerCase();

    const hasNumbers = /\d+/.test(lowerText);
    const hasUnits = /(kg|m\/s|cm|mm|km|joule|watt|volt|ampere|celsius|fahrenheit|percent|%|dollar|\$|rupee|₹)/.test(lowerText);
    const hasFormulas = /(=|equals|\+|\-|\*|\/|divided|multiplied|plus|minus)/.test(lowerText);

    const hasDerivations = DERIVATION_KEYWORDS.some(kw => lowerText.includes(kw));
    const hasChemicalEquations = CHEMICAL_EQ_KEYWORDS.some(kw => lowerText.includes(kw));
    const hasLongAnswerTopics = LONG_ANSWER_KEYWORDS.some(kw => lowerText.includes(kw));

    let subjectType = 'general';
    let hasNumericals = false;

    for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
      if (keywords.some(kw => lowerText.includes(kw))) {
        subjectType = subject;
        hasNumericals = hasNumbers && (subject === 'finance' || hasFormulas || hasUnits);
        break;
      }
    }

    return { subjectType, hasNumericals, hasNumbers, hasFormulas, hasUnits, hasDerivations, hasChemicalEquations, hasLongAnswerTopics };
  }

  extractNumericalData(text) {
    const sentences = (text || this.contentExtractor.getText()).split(/[.!?]+/);
    const formulas = [];
    const examples = [];

    sentences.forEach(sentence => {
      if (!sentence || sentence.trim().length === 0) return;
      const hasNumber = /\d+/.test(sentence);
      const hasOperation = /(=|equals|\+|\-|\*|\/|divided|multiplied|plus|minus|calculate|solve|find|determine)/.test(sentence.toLowerCase());
      if (hasNumber && hasOperation) examples.push(sentence.trim());
      const formulaPattern = /([a-zA-Z]\s*=\s*[^.!?]+)/g;
      const found = sentence.match(formulaPattern);
      if (found) formulas.push(...found);
    });

    return { formulas, examples };
  }

  // ── Local Fallback Quiz Generation ───────────────────────────────────────

  createDifficultyBasedLocalQuiz(text) {
    try {
      const captionText = text || this.contentExtractor.getText();
      if (!captionText || captionText.length < CONTENT_THRESHOLDS.MIN_QUIZ_CHARS) {
        return [this._fallbackQuestion()];
      }

      const sentences = captionText.split(/[.!?]+/).filter(s => s.trim().length > CONTENT_THRESHOLDS.MIN_QUESTION_SENTENCE_LENGTH);
      if (sentences.length === 0) return [this._fallbackQuestion()];

      const keyTerms = this.extractKeyTerms(captionText);
      const questions = [];

      for (let i = 0; i < this.numQuestions && i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        questions.push({
          type: 'multiple-choice',
          question: `Based on the content: "${sentence.substring(0, 80)}..."`,
          options: [
            'This accurately describes a key concept explained',
            'This is incorrect information',
            'This was not mentioned in the content',
            'This contradicts the main ideas presented'
          ],
          correct: 0,
          detailedSolution: 'This question tests basic comprehension.',
          difficulty: this.difficultyLevel,
          examTopic: 'Content Comprehension',
          marks: 1
        });
      }

      while (questions.length < 3) questions.push(this._fallbackQuestion());
      return questions.slice(0, this.numQuestions);
    } catch (error) {
      console.error('Local quiz generation failed:', error);
      return [this._fallbackQuestion()];
    }
  }

  extractKeyTerms(text) {
    try {
      const words = (text || this.contentExtractor.getText()).toLowerCase().split(/\W+/).filter(w => w.length > 3);
      const wordCount = {};
      words.forEach(word => { wordCount[word] = (wordCount[word] || 0) + 1; });
      return Object.entries(wordCount)
        .filter(([word, count]) => count > CONTENT_THRESHOLDS.MIN_KEY_TERM_OCCURRENCES && word.length > CONTENT_THRESHOLDS.MIN_KEY_TERM_LENGTH)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([word]) => word);
    } catch (error) {
      return ['concept', 'topic', 'information', 'content'];
    }
  }

  // ── Quiz Display ─────────────────────────────────────────────────────────

  displayQuiz(questions) {
    this.quizStartTime = Date.now();
    const questionsContainer = document.getElementById('quiz-questions');

    let html = `<div class="quiz-header">
      <h4>🎯 ${this.difficultyLevel.toUpperCase()} Level Quiz (${questions.length} questions)</h4>
    </div>`;

    questions.forEach((q, index) => {
      const config = DIFFICULTY_CONFIG[q.difficulty] || DIFFICULTY_CONFIG.basic;

      html += `<div class="quiz-question" data-question="${index}">
        <div class="question-header">
          <span class="question-number">Q${index + 1}</span>
          <span class="question-type">${q.type.replace('-', ' ')}</span>
          <span class="difficulty-badge" style="background: ${config.color};">${config.icon} ${q.difficulty.toUpperCase()}</span>
          ${q.marks ? `<span class="marks-badge">[${q.marks} marks]</span>` : ''}
        </div>
        ${q.examTopic ? `<div class="exam-topic" style="font-size: 11px; color: #666; margin-bottom: 8px; font-style: italic;">📚 Topic: ${q.examTopic}</div>` : ''}
        <div class="question-text">${q.question}</div>`;

      if (q.type === 'multiple-choice') {
        html += '<div class="question-options">';
        q.options.forEach((option, optIndex) => {
          html += `<label class="option-label" data-option="${optIndex}">
            <input type="radio" name="q${index}" value="${optIndex}" data-question="${index}" data-answer="${optIndex}">
            <span>${String.fromCharCode(65 + optIndex)}. ${option}</span>
          </label>`;
        });
        html += '</div>';
      } else if (q.type === 'short-answer') {
        html += `<div class="question-input">
          <textarea rows="3" placeholder="Write your answer in 2-3 lines..." data-question="${index}" data-answer="${q.answer}" style="width: 100%; border: 2px solid #28a745; border-radius: 8px; padding: 12px; font-family: inherit; resize: vertical;"></textarea>
        </div>`;
      } else if (q.type === 'long-answer') {
        html += `<div class="question-input">
          <textarea rows="6" placeholder="Write detailed answer in 4-6 lines..." data-question="${index}" data-answer="${q.answer}" style="width: 100%; border: 2px solid #dc3545; border-radius: 8px; padding: 12px; font-family: inherit; resize: vertical;"></textarea>
        </div>`;
      } else if (q.type === 'derivation') {
        html += `<div class="question-input">
          <textarea rows="8" placeholder="Show step-by-step derivation..." data-question="${index}" data-answer="${q.answer}" style="width: 100%; border: 2px solid #6f42c1; border-radius: 8px; padding: 12px; font-family: 'Courier New', monospace; resize: vertical;"></textarea>
          <div class="derivation-hint">💡 Include: Starting equations → Each step → Final result</div>
        </div>`;
      } else if (q.type === 'chemical-equation') {
        html += `<div class="question-input">
          <input type="text" placeholder="Write balanced chemical equation (e.g., 2H₂ + O₂ → 2H₂O)" data-question="${index}" data-answer="${q.answer}" style="width: 100%; border: 2px solid #fd7e14; border-radius: 8px; padding: 12px; font-family: 'Courier New', monospace;">
          <div class="equation-hint">💡 Balance the equation and use proper chemical formulas</div>
        </div>`;
      } else if (q.type === 'numerical') {
        html += `<div class="question-input">
          <input type="text" placeholder="Enter numerical answer with units..." data-question="${index}" data-answer="${q.answer}" style="width: 100%; border: 2px solid #007bff; border-radius: 8px; padding: 12px;">
          <div class="numerical-hint">💡 Include units and round to appropriate decimal places</div>
        </div>`;
      }

      html += '</div>';
    });

    questionsContainer.innerHTML = html;
    this.addQuestionEventListeners();
    document.getElementById('quiz-actions').style.display = 'block';
  }

  addQuestionEventListeners() {
    const container = document.getElementById('quiz-questions');

    container.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.userAnswers[parseInt(e.target.dataset.question)] = parseInt(e.target.dataset.answer);
      });
    });

    container.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
      input.addEventListener('input', (e) => {
        this.userAnswers[parseInt(e.target.dataset.question)] = e.target.value;
      });
    });

    container.querySelectorAll('textarea').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        this.userAnswers[parseInt(e.target.dataset.question)] = e.target.value;
      });
    });
  }

  // ── Answer Checking & Scoring ────────────────────────────────────────────

  async checkAnswers() {
    if (!this.currentQuiz) return;

    this.quizEndTime = Date.now();
    const results = this.calculateResults();
    this.displayResults(results);

    document.getElementById('quiz-actions').style.display = 'none';
    const newQuizBtn = document.getElementById('new-quiz');
    if (newQuizBtn) newQuizBtn.style.display = 'block';

    const timeTaken = Math.round((this.quizEndTime - (this.quizStartTime || Date.now())) / 1000);

    // Use a modal-style input instead of window.prompt
    let username = window.prompt('Enter your name for Leaderboard:', 'User');
    if (!username) username = 'User';

    // Persist to storage
    const videoId = this.contentExtractor.getVideoId() || 'unknown';
    await PyiceStorage.addLeaderboardEntry(videoId, {
      name: username,
      percentage: results.percentage,
      timeTaken: timeTaken,
      date: new Date().toISOString()
    });

    this.showLeaderboardButton();
  }

  calculateResults() {
    let totalScore = 0;
    let maxScore = 0;
    const questionResults = [];

    this.currentQuiz.forEach((question, index) => {
      const userAnswer = this.userAnswers[index];
      let score = 0;
      let maxMarks = question.marks || 1;
      let correctAnswer = '';
      let feedback = '';
      let isCorrect = false;

      maxScore += maxMarks;

      if (question.type === 'multiple-choice') {
        const userNum = userAnswer !== undefined ? parseInt(userAnswer) : -1;
        isCorrect = !isNaN(userNum) && userNum === parseInt(question.correct);
        score = isCorrect ? maxMarks : 0;
        correctAnswer = question.options[question.correct];
        feedback = isCorrect ? 'Perfect!' : 'Incorrect option selected.';
      } else {
        const smartResult = this.smartAnswerCheck(userAnswer, question);
        score = smartResult.score;
        isCorrect = smartResult.isCorrect;
        correctAnswer = question.answer;
        feedback = smartResult.feedback;
      }

      totalScore += score;
      questionResults.push({
        question: question.question, userAnswer, correctAnswer, isCorrect,
        score, maxMarks, feedback,
        explanation: question.detailedSolution || question.explanation || '',
        type: question.type,
        partialCredit: score > 0 && score < maxMarks
      });
    });

    return {
      correct: questionResults.filter(q => q.isCorrect).length,
      total: this.currentQuiz.length,
      percentage: Math.round((totalScore / maxScore) * 100),
      questions: questionResults,
      totalScore, maxScore,
      partialCreditQuestions: questionResults.filter(q => q.partialCredit).length
    };
  }

  // ── Smart Answer Checking ────────────────────────────────────────────────

  smartAnswerCheck(userAnswer, question) {
    if (!userAnswer || userAnswer.toString().trim().length === 0) {
      return { score: 0, isCorrect: false, feedback: 'No answer provided' };
    }

    const userText = userAnswer.toString().toLowerCase().trim();
    const expectedText = question.answer.toString().toLowerCase().trim();
    const maxMarks = question.marks || 1;

    // 4-method weighted scoring
    const keywordScore = this._evaluateKeywords(userText, expectedText) * 0.4;
    const semanticScore = this._evaluateSemanticSimilarity(userText, expectedText) * 0.3;
    const structureScore = this._evaluateStructure(userText, question.type) * 0.15;
    const contextScore = this._evaluateContext(userText, question) * 0.15;

    const totalScore = keywordScore + semanticScore + structureScore + contextScore;
    const finalScore = Math.min(totalScore * maxMarks, maxMarks);
    const isCorrect = finalScore >= (maxMarks * 0.8);

    return {
      score: Math.round(finalScore * 10) / 10,
      isCorrect,
      feedback: this._generateFeedback(totalScore)
    };
  }

  _evaluateKeywords(userText, expectedText) {
    const extractKw = (text) => text.replace(/[^\w\s]/g, ' ').split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w) && /[a-zA-Z]/.test(w));

    const expected = extractKw(expectedText);
    const user = extractKw(userText);
    if (expected.length === 0) return 0.5;

    let matches = 0;
    expected.forEach(ew => {
      if (user.includes(ew) || user.some(uw => this._areWordsSimilar(uw, ew))) matches++;
    });

    return Math.min(matches / expected.length, 1.0);
  }

  _evaluateSemanticSimilarity(userText, expectedText) {
    const userSentences = userText.split(/[.!?]+/).filter(s => s.trim().length > 5);
    const expectedConcepts = expectedText.split(/\W+/).filter(w => w.length > 4);
    if (expectedConcepts.length === 0) return 0.5;

    let overlap = 0;
    expectedConcepts.forEach(concept => {
      if (userText.includes(concept) || userText.split(/\W+/).some(w => this._areWordsSimilar(w, concept))) overlap++;
    });

    return Math.min(overlap / expectedConcepts.length, 1.0);
  }

  _evaluateStructure(userText, questionType) {
    const expected = EXPECTED_LENGTHS[questionType] || { min: 30, max: 150 };
    const len = userText.length;
    if (len >= expected.min && len <= expected.max) return 1.0;
    if (len >= expected.min * 0.5) return 0.6;
    return Math.min(len / (expected.min * 0.5), 0.4);
  }

  _evaluateContext(userText, question) {
    const qWords = question.question.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
    const aWords = userText.split(/\s+/);
    if (qWords.length === 0) return 0.5;

    let relevant = 0;
    qWords.forEach(qw => {
      if (aWords.some(aw => this._areWordsSimilar(aw, qw))) relevant++;
    });

    return Math.min(relevant / qWords.length, 1.0);
  }

  _areWordsSimilar(w1, w2) {
    if (w1 === w2) return true;
    if (w1.length >= 4 && w2.length >= 4 && (w1.includes(w2) || w2.includes(w1))) return true;

    for (const [base, synonyms] of Object.entries(WORD_VARIATIONS)) {
      if ((w1 === base && synonyms.includes(w2)) || (w2 === base && synonyms.includes(w1)) ||
          (synonyms.includes(w1) && synonyms.includes(w2))) return true;
    }

    // Levenshtein distance
    if (this._levenshtein(w1, w2) <= Math.min(w1.length, w2.length) * 0.3) return true;
    return false;
  }

  _levenshtein(s1, s2) {
    const matrix = [];
    for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        matrix[i][j] = s2[i-1] === s1[j-1]
          ? matrix[i-1][j-1]
          : Math.min(matrix[i-1][j-1]+1, matrix[i][j-1]+1, matrix[i-1][j]+1);
      }
    }
    return matrix[s2.length][s1.length];
  }

  _generateFeedback(score) {
    if (score >= 0.9) return 'Excellent answer!';
    if (score >= 0.8) return 'Very good understanding shown.';
    if (score >= 0.7) return 'Good answer with room for improvement.';
    if (score >= 0.6) return 'Adequate answer, could be more comprehensive.';
    if (score >= 0.4) return 'Partial understanding demonstrated.';
    return 'Answer needs significant improvement.';
  }

  // ── Results Display ──────────────────────────────────────────────────────

  displayResults(results) {
    const container = document.getElementById('quiz-results');
    const grade = GRADE_THRESHOLDS.find(g => results.percentage >= g.min);

    let html = `
      <div class="results-header">
        <div class="score-circle" style="background: ${grade.color};">${results.percentage}%</div>
        <div class="grade-badge" style="background: ${grade.color}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0;">
          Grade: ${grade.grade}
        </div>
        <div class="score-text">
          Smart Scoring: ${results.totalScore.toFixed(1)}/${results.maxScore} points
          <br><small>(${results.correct} fully correct, ${results.partialCreditQuestions} partial credit)</small>
        </div>
        <div class="performance-text">${grade.text}</div>
      </div>
      <div class="question-reviews"><h5>📋 Detailed Question Review:</h5>`;

    results.questions.forEach((q, index) => {
      const pct = q.maxMarks > 0 ? Math.round((q.score / q.maxMarks) * 100) : 0;
      const color = pct >= 80 ? '#28a745' : pct >= 60 ? '#ffc107' : pct > 0 ? '#fd7e14' : '#dc3545';
      const icon = pct >= 80 ? '✅' : pct >= 60 ? '⚡' : pct > 0 ? '⚠️' : '❌';

      html += `
        <div class="question-review" style="margin: 12px 0; padding: 16px; background: white; border-radius: 8px; border-left: 4px solid ${color};">
          <div class="review-question" style="font-weight: 500; margin-bottom: 8px;">
            Q${index + 1}: ${q.question}
            <span style="float: right; background: ${color}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">
              ${icon} ${q.score.toFixed(1)}/${q.maxMarks}
            </span>
          </div>
          <div style="background: #f8f9fa; border-left: 3px solid ${color}; padding: 10px; margin: 8px 0; border-radius: 0 6px 6px 0;">
            <strong>🤖 Smart Analysis:</strong> ${q.feedback}
          </div>`;

      if (this.currentQuiz[index].type === 'multiple-choice') {
        const userIdx = this.userAnswers[index];
        const correctIdx = this.currentQuiz[index].correct;
        html += `<div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin: 8px 0;">`;
        if (userIdx !== undefined) {
          const isRight = parseInt(userIdx) === parseInt(correctIdx);
          html += `<div style="margin-bottom: 8px;"><strong>Your Answer:</strong>
            <div style="padding: 8px; margin: 4px 0; border-radius: 4px; background: ${isRight ? '#d4edda' : '#f8d7da'}; border-left: 4px solid ${isRight ? '#28a745' : '#dc3545'};">
              ${isRight ? '✅' : '❌'} <strong>${String.fromCharCode(65 + parseInt(userIdx))}.</strong> ${this.currentQuiz[index].options[userIdx]}
            </div></div>`;
        } else {
          html += `<div style="padding: 8px; margin: 4px 0; border-radius: 4px; background: #fff3cd; border-left: 4px solid #ffc107;">⚠️ <strong>No answer provided</strong></div>`;
        }
        if (userIdx === undefined || parseInt(userIdx) !== parseInt(correctIdx)) {
          html += `<div style="margin-top: 8px;"><strong>Correct Answer:</strong>
            <div style="padding: 8px; margin: 4px 0; border-radius: 4px; background: #d4edda; border-left: 4px solid #28a745;">
              ✅ <strong>${String.fromCharCode(65 + correctIdx)}.</strong> ${this.currentQuiz[index].options[correctIdx]}
            </div></div>`;
        }
        html += `</div>`;
      } else {
        html += `<div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin: 8px 0;">
          <div style="margin-bottom: 8px;"><strong>Your Answer:</strong></div>
          <div style="color: #666; font-style: italic; padding: 8px; background: white; border-radius: 4px;">${q.userAnswer || 'No answer provided'}</div>
          <div style="margin: 8px 0 4px;"><strong>Expected Answer:</strong></div>
          <div style="color: #28a745; padding: 8px; background: #d4edda; border-radius: 4px;">${q.correctAnswer}</div>
        </div>`;
      }

      if (q.explanation) {
        html += `<div style="background: #e7f3ff; border-left: 3px solid #007bff; padding: 10px; margin-top: 8px; border-radius: 0 6px 6px 0;">
          <strong>💡 Detailed Solution:</strong><br>
          <div style="font-size: 13px; line-height: 1.4; margin-top: 4px;">${q.explanation}</div>
        </div>`;
      }

      html += `</div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    container.style.display = 'block';
  }

  // ── Leaderboard ──────────────────────────────────────────────────────────

  showLeaderboardButton() {
    let btn = document.getElementById('show-leaderboard');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'show-leaderboard';
      btn.className = 'quiz-btn';
      btn.textContent = '🏆 View Leaderboard';
      btn.onclick = () => this.displayLeaderboard();
      const resultsSection = document.getElementById('quiz-results');
      if (resultsSection) resultsSection.appendChild(btn);
    }
    btn.style.display = 'block';
  }

  async displayLeaderboard() {
    const videoId = this.contentExtractor.getVideoId() || 'unknown';
    const entries = await PyiceStorage.getLeaderboard(videoId);
    const sorted = entries.sort((a, b) => b.percentage - a.percentage || a.timeTaken - b.timeTaken);

    let html = `
      <div id="leaderboard-container" class="results-header">
        <h4>🏆 Quiz Leaderboard</h4>
        <table style="width:100%; margin-top:10px;">
          <tr><th>Rank</th><th>Name</th><th>Score(%)</th><th>Time(s)</th></tr>
          ${sorted.map((entry, i) => `
            <tr><td>${i + 1}</td><td>${entry.name}</td><td>${entry.percentage}</td><td>${entry.timeTaken}</td></tr>
          `).join('')}
        </table>
        <button class="quiz-btn" id="close-leaderboard">Close</button>
      </div>`;

    document.getElementById('quiz-results').innerHTML = html;
    document.getElementById('close-leaderboard').onclick = () => {
      document.getElementById('quiz-results').style.display = 'none';
      setTimeout(() => {
        document.getElementById('quiz-results').style.display = 'block';
        this.displayResults(this.calculateResults());
      }, 100);
    };
  }

  // ── Reset & Utility ──────────────────────────────────────────────────────

  checkAvailableOptions() {
    document.getElementById('quiz-start-section').style.display = 'block';
    document.getElementById('num-questions-section').style.display = 'none';
    document.getElementById('quiz-status').textContent = 'Ready to generate quiz from content!';
  }

  resetUI() {
    this.contentExtractor.reset();
    this.currentQuiz = null;
    this.userAnswers = {};
    this.difficultyLevel = 'basic';

    document.getElementById('quiz-collection').style.display = 'none';
    document.getElementById('quiz-results').style.display = 'none';
    document.getElementById('quiz-actions').style.display = 'none';
    document.getElementById('new-quiz').style.display = 'none';
    document.getElementById('quiz-display').style.display = 'none';
    document.getElementById('quiz-start-section').style.display = 'block';
    document.getElementById('num-questions-section').style.display = 'none';
    document.getElementById('quiz-status').textContent = 'Ready to generate quiz from content!';

    const manualSection = document.getElementById('manual-input-section');
    if (manualSection) manualSection.remove();
  }

  showError(message) {
    const el = document.getElementById('quiz-status');
    el.innerHTML = `<span class="error">❌ ${message}</span>`;
  }

  showSuccess(message) {
    const el = document.getElementById('quiz-status');
    el.innerHTML = `<span class="success">✅ ${message}</span>`;
  }
}

console.log('🎯 PYICE Quiz Generator module loaded');
