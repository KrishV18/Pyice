/**
 * PYICE Main Bootstrap
 * Single entry point for button injection and SPA navigation handling.
 * Loaded last by manifest — depends on all other modules being available.
 */

(function () {
  'use strict';

  function addExtensionButtons() {
    // Remove existing container to prevent duplicates
    const existing = document.getElementById('pyice-buttons-container');
    if (existing) existing.remove();

    // Only inject on YouTube watch pages
    if (!window.location.pathname.startsWith('/watch')) return;

    // Create floating button container
    const container = document.createElement('div');
    container.id = 'pyice-buttons-container';
    container.className = 'pyice-btn-container';

    // Quiz button
    const quizBtn = document.createElement('button');
    quizBtn.id = 'pyice-quiz-btn';
    quizBtn.className = 'pyice-btn pyice-btn-quiz';
    quizBtn.textContent = '🎯 Quiz';
    quizBtn.addEventListener('click', () => {
      if (!window.pyiceQuizGenerator) {
        window.pyiceQuizGenerator = new YouTubeQuizGenerator();
      } else {
        const ui = document.getElementById('quiz-generator-ui');
        if (ui) ui.style.display = 'block';
      }
    });

    // Notes button
    const notesBtn = document.createElement('button');
    notesBtn.id = 'pyice-notes-btn';
    notesBtn.className = 'pyice-btn pyice-btn-notes';
    notesBtn.textContent = '📝 Notes';
    notesBtn.addEventListener('click', () => {
      if (!window.pyiceNotesGenerator) {
        window.pyiceNotesGenerator = new YouTubeNotesGenerator();
      }
      window.pyiceNotesGenerator.showNotesUI();
    });

    container.appendChild(quizBtn);
    container.appendChild(notesBtn);
    document.body.appendChild(container);
  }

  // ── SPA Navigation Handling ──────────────────────────────────────────────

  function onNavigate() {
    // Small delay to let YouTube finish rendering
    setTimeout(() => {
      addExtensionButtons();
      
      // Reset generators if video changes so stale state doesn't persist
      if (window.pyiceQuizGenerator) {
        window.pyiceQuizGenerator.resetUI();
        window.pyiceQuizGenerator.uiContainer.style.display = 'none';
      }
      if (window.pyiceNotesGenerator) {
        // Assuming notes generator has a similar reset or hide method
        const ui = document.getElementById('notes-generator-ui');
        if (ui) ui.style.display = 'none';
      }
    }, 500);
  }

  // YouTube SPA navigation events
  window.addEventListener('yt-navigate-finish', onNavigate);
  window.addEventListener('DOMContentLoaded', onNavigate);
  window.addEventListener('load', onNavigate);

  // Fallback: inject after 2 seconds if events don't fire
  setTimeout(addExtensionButtons, 2000);

  console.log('🚀 PYICE extension loaded!');
})();
