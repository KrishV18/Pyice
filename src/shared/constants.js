/**
 * PYICE Shared Constants
 * Centralizes all magic numbers, selectors, API endpoints, and config defaults.
 */

// ── API Configuration ──────────────────────────────────────────────────────────

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const GEMINI_MODELS = {
  QUIZ: 'gemini-2.5-flash',
  NOTES: 'gemini-2.0-flash-exp',
  TRANSLATE: 'gemini-2.5-flash'
};

const API_DEFAULTS = {
  QUIZ_MAX_TOKENS: 5000,
  NOTES_MAX_TOKENS: 8192,
  NOTES_TEMPERATURE: 0.7,
  NOTES_TOP_K: 40,
  NOTES_TOP_P: 0.95,
  TIMEOUT_MS: 30000,
  RETRY_COUNT: 1,
  RETRY_DELAY_MS: 2000
};

// ── YouTube DOM Selectors ──────────────────────────────────────────────────────

const YT_SELECTORS = {
  // Caption / subtitle elements
  CAPTION_WINDOW: '.ytp-caption-window-bottom',
  CAPTION_SEGMENT: '.ytp-caption-segment',
  SUBTITLES_BUTTON: '.ytp-subtitles-button',

  // Transcript panel selectors (multiple fallbacks for YouTube layout changes)
  TRANSCRIPT_SELECTORS: [
    '#segments-container .segment-text',
    'ytd-transcript-segment-renderer .segment-text',
    '.ytd-transcript-body-renderer .segment-text',
    'yt-formatted-string.segment-text'
  ],

  // Transcript open button selectors
  TRANSCRIPT_BUTTON_SELECTORS: [
    'button[aria-label="Show transcript"]',
    '#button[aria-label="Show transcript"]',
    'ytd-button-renderer:has(yt-formatted-string)',
    'tp-yt-paper-button[aria-label="Show transcript"]'
  ],

  // SPA navigation observer target
  NAVIGATION_TARGET: document
};

// ── Content Thresholds ─────────────────────────────────────────────────────────

const CONTENT_THRESHOLDS = {
  MIN_QUIZ_CHARS: 50,
  MIN_NOTES_CHARS: 100,
  MIN_SENTENCE_LENGTH: 20,
  MIN_QUESTION_SENTENCE_LENGTH: 30,
  CAPTION_AUTO_STOP_CHARS: 3000,
  NOTES_CAPTION_AUTO_STOP_CHARS: 800,
  CAPTION_CHECK_INTERVAL_MS: 50000,
  MAX_CONTENT_FOR_API: 8000,
  MIN_KEY_TERM_LENGTH: 4,
  MIN_KEY_TERM_OCCURRENCES: 2
};

// ── Difficulty Configuration ───────────────────────────────────────────────────

const DIFFICULTY_CONFIG = {
  basic: {
    label: 'BASIC',
    icon: '🟢',
    color: '#28a745',
    numQuestions: 5,
    allowedTypes: ['multiple-choice']
  },
  intermediate: {
    label: 'INTERMEDIATE',
    icon: '🟡',
    color: '#ffc107',
    numQuestions: 10,
    allowedTypes: ['multiple-choice', 'short-answer', 'numerical']
  },
  advanced: {
    label: 'ADVANCED',
    icon: '🔴',
    color: '#dc3545',
    numQuestions: 20,
    allowedTypes: ['multiple-choice', 'short-answer', 'long-answer', 'derivation', 'numerical', 'chemical-equation']
  }
};

// ── Marks Allocation ───────────────────────────────────────────────────────────

const MARKS_MAP = {
  'multiple-choice': 1,
  'short-answer': 3,
  'long-answer': 5,
  'derivation': 5,
  'numerical': 3,
  'chemical-equation': 4
};

// ── Expected Answer Lengths ────────────────────────────────────────────────────

const EXPECTED_LENGTHS = {
  'short-answer': { min: 50, max: 200 },
  'long-answer': { min: 150, max: 500 },
  'derivation': { min: 100, max: 400 },
  'numerical': { min: 10, max: 100 },
  'chemical-equation': { min: 10, max: 100 }
};

const EXPECTED_SENTENCES = {
  'short-answer': { min: 2, max: 4 },
  'long-answer': { min: 4, max: 8 },
  'derivation': { min: 3, max: 10 },
  'numerical': { min: 1, max: 3 },
  'chemical-equation': { min: 1, max: 2 }
};

// ── Subject Detection Keywords ─────────────────────────────────────────────────

const SUBJECT_KEYWORDS = {
  mathematics: [
    'equation', 'formula', 'calculate', 'solve', 'derivative', 'integral', 'theorem', 'proof',
    'graph', 'function', 'variable', 'coefficient', 'algebra', 'geometry', 'trigonometry',
    'statistics', 'probability', 'differentiation', 'integration', 'limit', 'series', 'matrix',
    'vector', 'calculus', 'polynomial', 'logarithm', 'exponential', 'quadratic', 'linear',
    'parabola', 'sine', 'cosine', 'tangent', 'trigonometric', 'radian', 'degree',
    'multiply', 'divide', 'subtract', 'addition', 'square', 'cube', 'root',
    'factorial', 'permutation', 'combination', 'summation',
    'equals', 'plus', 'minus', 'times', 'divided by', 'power of', 'squared', 'cubed'
  ],
  physics: [
    'force', 'velocity', 'acceleration', 'energy', 'power', 'voltage', 'current',
    'resistance', 'frequency', 'wavelength', 'mass', 'density', 'pressure', 'temperature'
  ],
  chemistry: [
    'molecule', 'reaction', 'molarity', 'ph', 'concentration', 'atomic', 'electron',
    'proton', 'neutron', 'compound', 'element', 'periodic'
  ],
  finance: [
    'interest', 'investment', 'loan', 'profit', 'loss', 'percentage', 'compound',
    'simple interest', 'roi', 'npv'
  ]
};

const DERIVATION_KEYWORDS = ['derive', 'proof', 'prove', 'show that', 'establish', 'demonstrate', 'deduce', 'from first principles'];
const CHEMICAL_EQ_KEYWORDS = ['balance', 'chemical equation', 'reaction equation', 'stoichiometry', 'reactants', 'products'];
const LONG_ANSWER_KEYWORDS = ['explain in detail', 'discuss', 'elaborate', 'describe thoroughly', 'analyze', 'evaluate', 'compare'];

// ── Language Codes ─────────────────────────────────────────────────────────────

const LANGUAGE_NAMES = {
  'hi': 'Hindi', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean',
  'ar': 'Arabic', 'ru': 'Russian', 'es': 'Spanish', 'fr': 'French',
  'de': 'German', 'it': 'Italian'
};

// ── Stop Words for Scoring ─────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
  'we', 'our', 'you', 'your'
]);

// ── Synonym Map for Scoring ────────────────────────────────────────────────────

const WORD_VARIATIONS = {
  'calculate': ['compute', 'determine', 'find'],
  'formula': ['equation', 'expression'],
  'increase': ['rise', 'grow', 'expand'],
  'decrease': ['fall', 'reduce', 'decline'],
  'important': ['significant', 'crucial', 'key'],
  'different': ['various', 'distinct', 'separate'],
  'similar': ['alike', 'comparable', 'equivalent']
};

// ── SVG Color Palettes ─────────────────────────────────────────────────────────

const SVG_COLORS = {
  MINDMAP: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'],
  TOPIC: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'],
  HANDDRAWN: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57']
};

// ── Storage Keys ───────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  API_KEY: 'pyice_api_key',
  SETTINGS: 'pyice_settings',
  QUIZ_CACHE_PREFIX: 'pyice_quiz_cache_',
  NOTES_CACHE_PREFIX: 'pyice_notes_cache_',
  LEADERBOARD_PREFIX: 'pyice_leaderboard_'
};

// ── Grade Thresholds ───────────────────────────────────────────────────────────

const GRADE_THRESHOLDS = [
  { min: 90, text: 'Outstanding! You have mastered the content excellently.', color: '#28a745', grade: 'A+' },
  { min: 80, text: 'Excellent! You have a great understanding of the content.', color: '#28a745', grade: 'A' },
  { min: 70, text: 'Good work! You understood most of the key concepts.', color: '#ffc107', grade: 'B' },
  { min: 60, text: 'Fair performance. Review the concepts and practice more.', color: '#fd7e14', grade: 'C' },
  { min: 50, text: 'Below average. Focus on understanding the fundamentals.', color: '#dc3545', grade: 'D' },
  { min: 0, text: 'Keep studying! Review the content thoroughly and try again.', color: '#dc3545', grade: 'F' }
];

console.log('📦 PYICE constants loaded');
