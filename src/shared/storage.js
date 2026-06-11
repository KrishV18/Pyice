/**
 * PYICE Storage Module
 * Wraps chrome.storage.sync (settings) and chrome.storage.local (cache/leaderboard).
 */

class PyiceStorage {

  // ── API Key Management (sync across devices) ──────────────────────────────

  static async getApiKey() {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.API_KEY);
      return result[STORAGE_KEYS.API_KEY] || '';
    } catch (error) {
      console.warn('Failed to get API key from storage:', error);
      return '';
    }
  }

  static async setApiKey(key) {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEYS.API_KEY]: key });
      console.log('API key saved to storage');
      return true;
    } catch (error) {
      console.error('Failed to save API key:', error);
      return false;
    }
  }

  static async clearApiKey() {
    try {
      await chrome.storage.sync.remove(STORAGE_KEYS.API_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear API key:', error);
      return false;
    }
  }

  // ── Settings (sync) ──────────────────────────────────────────────────────

  static async getSettings() {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
      return result[STORAGE_KEYS.SETTINGS] || {
        defaultDifficulty: 'basic',
        defaultNumQuestions: 5
      };
    } catch (error) {
      console.warn('Failed to get settings:', error);
      return { defaultDifficulty: 'basic', defaultNumQuestions: 5 };
    }
  }

  static async updateSettings(partial) {
    try {
      const current = await PyiceStorage.getSettings();
      const updated = { ...current, ...partial };
      await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: updated });
      return true;
    } catch (error) {
      console.error('Failed to update settings:', error);
      return false;
    }
  }

  // ── Quiz Cache (local, keyed by videoId + contentHash) ────────────────────

  static async getCachedQuiz(videoId, contentHash) {
    const key = STORAGE_KEYS.QUIZ_CACHE_PREFIX + videoId + '_' + contentHash;
    try {
      const result = await chrome.storage.local.get(key);
      const cached = result[key];
      if (cached && cached.timestamp && Date.now() - cached.timestamp < 86400000) {
        // Cache valid for 24 hours
        return cached.data;
      }
      return null;
    } catch (error) {
      console.warn('Quiz cache read failed:', error);
      return null;
    }
  }

  static async setCachedQuiz(videoId, contentHash, questions) {
    const key = STORAGE_KEYS.QUIZ_CACHE_PREFIX + videoId + '_' + contentHash;
    try {
      await chrome.storage.local.set({
        [key]: { data: questions, timestamp: Date.now() }
      });
    } catch (error) {
      console.warn('Quiz cache write failed:', error);
    }
  }

  // ── Notes Cache (local, keyed by videoId + contentHash) ───────────────────

  static async getCachedNotes(videoId, contentHash) {
    const key = STORAGE_KEYS.NOTES_CACHE_PREFIX + videoId + '_' + contentHash;
    try {
      const result = await chrome.storage.local.get(key);
      const cached = result[key];
      if (cached && cached.timestamp && Date.now() - cached.timestamp < 86400000) {
        return cached.data;
      }
      return null;
    } catch (error) {
      console.warn('Notes cache read failed:', error);
      return null;
    }
  }

  static async setCachedNotes(videoId, contentHash, notes) {
    const key = STORAGE_KEYS.NOTES_CACHE_PREFIX + videoId + '_' + contentHash;
    try {
      await chrome.storage.local.set({
        [key]: { data: notes, timestamp: Date.now() }
      });
    } catch (error) {
      console.warn('Notes cache write failed:', error);
    }
  }

  // ── Leaderboard (local, keyed by videoId) ─────────────────────────────────

  static async getLeaderboard(videoId) {
    const key = STORAGE_KEYS.LEADERBOARD_PREFIX + videoId;
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] || [];
    } catch (error) {
      console.warn('Leaderboard read failed:', error);
      return [];
    }
  }

  static async addLeaderboardEntry(videoId, entry) {
    const key = STORAGE_KEYS.LEADERBOARD_PREFIX + videoId;
    try {
      const current = await PyiceStorage.getLeaderboard(videoId);
      current.push(entry);
      // Keep only top 50 entries per video
      const sorted = current
        .sort((a, b) => b.percentage - a.percentage || a.timeTaken - b.timeTaken)
        .slice(0, 50);
      await chrome.storage.local.set({ [key]: sorted });
      return sorted;
    } catch (error) {
      console.warn('Leaderboard write failed:', error);
      return [];
    }
  }

  static async clearLeaderboard(videoId) {
    const key = STORAGE_KEYS.LEADERBOARD_PREFIX + videoId;
    try {
      await chrome.storage.local.remove(key);
      return true;
    } catch (error) {
      console.warn('Leaderboard clear failed:', error);
      return false;
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /**
   * Simple hash for cache keys. Not cryptographic — just for deduplication.
   */
  static contentHash(text) {
    let hash = 0;
    const str = text.substring(0, 2000); // Only hash first 2000 chars for speed
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

console.log('💾 PYICE storage module loaded');
