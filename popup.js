/**
 * PYICE Popup Script
 * Handles API key management and status display in the extension popup.
 */

const STORAGE_KEY = 'pyice_api_key';

document.addEventListener('DOMContentLoaded', async () => {
  const input = document.getElementById('api-key-input');
  const toggleBtn = document.getElementById('toggle-key');
  const saveBtn = document.getElementById('save-key');
  const clearBtn = document.getElementById('clear-key');
  const statusMsg = document.getElementById('key-status');
  const statusBar = document.getElementById('status-bar');

  // ── Load existing key ──────────────────────────────────────────────────
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    const savedKey = result[STORAGE_KEY] || '';
    if (savedKey) {
      input.value = savedKey;
      showStatus('✅ API key loaded', 'success');
    }
  } catch (e) {
    console.warn('Could not load key:', e);
  }

  // ── Toggle visibility ──────────────────────────────────────────────────
  toggleBtn.addEventListener('click', () => {
    if (input.type === 'password') {
      input.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      input.type = 'password';
      toggleBtn.textContent = '👁';
    }
  });

  // ── Save key ───────────────────────────────────────────────────────────
  saveBtn.addEventListener('click', async () => {
    const key = input.value.trim();
    if (!key) {
      showStatus('⚠️ Please enter an API key', 'error');
      return;
    }
    if (!key.startsWith('AIza')) {
      showStatus('⚠️ Invalid key format (should start with AIza)', 'error');
      return;
    }
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: key });
      showStatus('✅ API key saved successfully!', 'success');
    } catch (e) {
      showStatus('❌ Failed to save key', 'error');
    }
  });

  // ── Clear key ──────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', async () => {
    try {
      await chrome.storage.sync.remove(STORAGE_KEY);
      input.value = '';
      showStatus('🗑 API key cleared', 'success');
    } catch (e) {
      showStatus('❌ Failed to clear key', 'error');
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

  function showStatus(message, type) {
    statusMsg.textContent = message;
    statusMsg.className = `status-msg ${type}`;
    setTimeout(() => { statusMsg.className = 'status-msg'; }, 3000);
  }
});
