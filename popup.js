/**
 * PYICE Popup Script
 * Handles API key management (Groq + Gemini) and status display in the extension popup.
 */

const GEMINI_STORAGE_KEY = 'pyice_api_key';

document.addEventListener('DOMContentLoaded', async () => {
  // ── Gemini Key Elements ─────────────────────────────────────────────────
  const geminiInput     = document.getElementById('api-key-input');
  const geminiToggle    = document.getElementById('toggle-key');
  const geminiSave      = document.getElementById('save-key');
  const geminiClear     = document.getElementById('clear-key');
  const geminiStatus    = document.getElementById('key-status');

  const statusBar       = document.getElementById('status-bar');

  // ── Load existing keys ─────────────────────────────────────────────────
  try {
    const result = await chrome.storage.sync.get([GEMINI_STORAGE_KEY]);

    const savedGemini = result[GEMINI_STORAGE_KEY] || '';
    if (savedGemini) {
      geminiInput.value = savedGemini;
      showStatus(geminiStatus, '✅ Gemini key loaded', 'success');
    }
  } catch (e) {
    console.warn('Could not load keys:', e);
  }

  // ── Gemini Key: Toggle visibility ───────────────────────────────────────
  geminiToggle.addEventListener('click', () => {
    if (geminiInput.type === 'password') {
      geminiInput.type = 'text';
      geminiToggle.textContent = '🙈';
    } else {
      geminiInput.type = 'password';
      geminiToggle.textContent = '👁';
    }
  });

  // ── Gemini Key: Save ────────────────────────────────────────────────────
  geminiSave.addEventListener('click', async () => {
    const key = geminiInput.value.trim();
    if (!key) {
      showStatus(geminiStatus, '⚠️ Please enter a Gemini API key', 'error');
      return;
    }
    if (!key.startsWith('AIza')) {
      showStatus(geminiStatus, '⚠️ Invalid key format (should start with AIza)', 'error');
      return;
    }
    try {
      await chrome.storage.sync.set({ [GEMINI_STORAGE_KEY]: key });
      showStatus(geminiStatus, '✅ Gemini API key saved!', 'success');
    } catch (e) {
      showStatus(geminiStatus, '❌ Failed to save key', 'error');
    }
  });

  // ── Gemini Key: Clear ───────────────────────────────────────────────────
  geminiClear.addEventListener('click', async () => {
    try {
      await chrome.storage.sync.remove(GEMINI_STORAGE_KEY);
      geminiInput.value = '';
      showStatus(geminiStatus, '🗑 Gemini key cleared', 'success');
    } catch (e) {
      showStatus(geminiStatus, '❌ Failed to clear key', 'error');
    }
  });

  // ── Check YouTube tab ──────────────────────────────────────────────────
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
      statusBar.textContent = '✅ YouTube video detected — Ready!';
      statusBar.className = 'status-bar ready';
    } else {
      statusBar.textContent = '📺 Navigate to a YouTube video to start';
      statusBar.className = 'status-bar not-ready';
    }
  } catch (e) {
    statusBar.textContent = '📺 Open a YouTube video to use PYICE';
    statusBar.className = 'status-bar not-ready';
  }

  function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status-msg ${type}`;
    setTimeout(() => { element.className = 'status-msg'; }, 3000);
  }
});
