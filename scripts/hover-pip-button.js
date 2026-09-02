const HIDE_TIMEOUT = 4000;

let pipButtonEnabled = true;
let settingsLoaded = false;
const createdButtons = new WeakMap();

async function loadPipButtonSetting() {
  try {
    const settings = await AutoPipContent.settings.getSettings();
    pipButtonEnabled = settings.pipButtonEnabled !== false;
  } catch (_) {
    pipButtonEnabled = true;
  } finally {
    settingsLoaded = true;
  }
}

function removePipButton(videoElement) {
  const btn = createdButtons.get(videoElement);
  if (!btn) return;

  if (btn._hideTimer) {
    clearTimeout(btn._hideTimer);
    btn._hideTimer = null;
  }

  btn.remove();
  createdButtons.delete(videoElement);
}

function removeAllPipButtons() {
  document.querySelectorAll('video').forEach((videoElement) => removePipButton(videoElement));
  document.querySelectorAll('.custom-pip-button').forEach((btn) => btn.remove());
}

function createPipButton(videoElement) {
  if (!settingsLoaded || !pipButtonEnabled) return;
  if (!videoElement || !document.pictureInPictureEnabled) return;
  if (createdButtons.has(videoElement)) return;

  const playerContainer =
    videoElement.closest('.html5-video-player') || videoElement.parentNode;
  if (!playerContainer || playerContainer.querySelector('.custom-pip-button')) return;

  const btn = document.createElement('div');
  btn.className = 'custom-pip-button';

  const icon = document.createElement('img');
  icon.className = 'pip-icon';
  icon.src = chrome.runtime.getURL('assets/enter.svg');

  btn.appendChild(icon);

  if (getComputedStyle(playerContainer).position === 'static') {
    playerContainer.style.position = 'relative';
  }

  playerContainer.appendChild(btn);
  createdButtons.set(videoElement, btn);

  let hideTimer;

  const showButton = () => {
    if (!pipButtonEnabled) return;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    clearTimeout(hideTimer);

    hideTimer = setTimeout(() => {
      btn.style.opacity = '0';
      btn.style.pointerEvents = 'none';
    }, HIDE_TIMEOUT);

    btn._hideTimer = hideTimer;
  };

  const revealButton = () => {
    if (!pipButtonEnabled) return;
    showButton();
  };

  // Reveal when the cursor enters the player. Once the button has
  // hidden, moving anywhere inside the player reveals it again.
  // There is no longer any distance/proximity check against the button.
  playerContainer.addEventListener('mouseenter', revealButton);
  playerContainer.addEventListener('mousemove', () => {
    if (!pipButtonEnabled) return;
    if (btn.style.opacity !== '1') revealButton();
  });

  btn.addEventListener('click', async (e) => {
    if (!pipButtonEnabled) return;

    e.stopPropagation();
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoElement.requestPictureInPicture();
      }
    } catch (error) {
      console.error("error блять...");
    }
  });

  videoElement.addEventListener('enterpictureinpicture', () => {
    icon.src = chrome.runtime.getURL('assets/back.svg');
  });

  videoElement.addEventListener('leavepictureinpicture', () => {
    icon.src = chrome.runtime.getURL('assets/enter.svg');
  });
}

function initPipButtons() {
  if (!settingsLoaded || !pipButtonEnabled) return;
  document.querySelectorAll('video').forEach(createPipButton);
}

async function initPipButtonFeature() {
  await loadPipButtonSetting();

  if (pipButtonEnabled) {
    initPipButtons();
  } else {
    removeAllPipButtons();
  }

  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' && areaName !== 'sync') return;
      if (!changes.pipButtonEnabled) return;

      const nextEnabled = changes.pipButtonEnabled.newValue !== false;
      pipButtonEnabled = nextEnabled;

      if (pipButtonEnabled) {
        initPipButtons();
      } else {
        removeAllPipButtons();
      }
    });
  }

  const observer = new MutationObserver((mutations) => {
    if (!pipButtonEnabled) return;

    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        document.querySelectorAll('video').forEach(createPipButton);
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

initPipButtonFeature();
