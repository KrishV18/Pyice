const BUCKET_SIZE = 30; // seconds

function buildBuckets(transcriptData) {
  const buckets = {};
  for (const entry of transcriptData) {
    const bucketIndex = Math.floor(entry.start / BUCKET_SIZE);
    if (!buckets[bucketIndex]) buckets[bucketIndex] = [];
    buckets[bucketIndex].push(entry);
  }
  return buckets;
}

function scoreBucket(entries) {
  const text = entries.map(e => e.text).join(' ');
  const words = text.split(/\s+/).filter(Boolean);
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')));

  const uniqueRatio = uniqueWords.size / Math.max(words.length, 1);
  const uniqueScore = Math.min(4, uniqueRatio * 8);

  const punctuationCount = (text.match(/[,;:]/g) || []).length;
  const punctuationScore = Math.min(3, (punctuationCount / words.length) * 15);

  const technicalTerms = [
    'therefore', 'consequently', 'equation', 'formula', 'theorem', 'hypothesis',
    'coefficient', 'derivative', 'integral', 'magnitude', 'velocity', 'acceleration',
    'respectively', 'proportion', 'logarithm', 'exponential', 'whereas', 'whereby',
    'simultaneously', 'phenomenon', 'molecular', 'chromosome', 'metabolism',
    'photosynthesis', 'mitosis', 'entropy', 'equilibrium', 'synthesis', 'analysis'
  ];
  const techCount = technicalTerms.filter(term =>
    text.toLowerCase().includes(term)
  ).length;
  const techScore = Math.min(3, techCount * 0.75);

  return uniqueScore + punctuationScore + techScore;
}

function getTier(score) {
  if (score >= 6)  return 'complex';
  if (score >= 3)  return 'moderate';
  return 'simple';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function createMarker(bucketIndex, tier, videoDuration) {
  const startSec = bucketIndex * 30;
  const percentPosition = (startSec / videoDuration) * 100;

  const marker = document.createElement('div');
  marker.className = `pyice-heatmap-marker pyice-marker-${tier}`;
  marker.style.cssText = `
    position: absolute;
    left: ${percentPosition}%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    z-index: 30;
    pointer-events: auto;
    cursor: pointer;
    transition: transform 0.15s;
  `;
  marker.dataset.bucketStart = startSec;
  marker.dataset.tier = tier;
  marker.title = `${tier === 'complex' ? '🔴 High concept density' : '🔵 Moderate density'} — ${formatTime(startSec)}`;
  
  marker.addEventListener('click', (e) => {
    e.stopPropagation();
    const video = document.querySelector('video');
    if (video) video.currentTime = parseInt(marker.dataset.bucketStart);
  });
  
  return marker;
}

let markersInjected = false;
let currentTranscriptData = null;

function injectHeatmap(transcriptData, videoDuration) {
  document.querySelectorAll('.pyice-heatmap-marker').forEach(el => el.remove());

  const progressBar = document.querySelector('.ytp-progress-bar-container')
                   || document.querySelector('.ytp-timed-markers-container');
  if (!progressBar || !videoDuration) return;

  const buckets = buildBuckets(transcriptData);
  for (const [bucketIndex, entries] of Object.entries(buckets)) {
    const score = scoreBucket(entries);
    const tier = getTier(score);
    if (tier === 'simple') continue;
    const marker = createMarker(parseInt(bucketIndex), tier, videoDuration);
    progressBar.appendChild(marker);
  }
  markersInjected = true;
}

const observer = new MutationObserver(() => {
  const progressBar = document.querySelector('.ytp-progress-bar-container');
  if (progressBar && !progressBar.querySelector('.pyice-heatmap-marker')) {
    const video = document.querySelector('video');
    if (video && video.duration && currentTranscriptData) {
      injectHeatmap(currentTranscriptData, video.duration);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });

window.initHeatmap = function(transcriptData, videoDuration) {
  currentTranscriptData = transcriptData;
  injectHeatmap(transcriptData, videoDuration);
};
