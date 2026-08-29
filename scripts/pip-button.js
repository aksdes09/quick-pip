(function initPiPButton() {
    'use strict';

    const AutoPipContent = window.AutoPipContent || {};
    const videoLib = AutoPipContent.video;
    const pip = AutoPipContent.pip;

    if (!videoLib || !pip) return;

    const BUTTON_CLASS = 'quick-pip-button';
    const WRAPPER_CLASS = 'quick-pip-button-wrapper';
    const STYLE_ID = 'quick-pip-button-style';
    const tracked = new WeakMap();
    const wrappers = new Set();
    const HIDE_DELAY = 5000;
    const REVEAL_DISTANCE = 80;

    const SVG_ENTER = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 20c-.55 0-1.02-.195-1.414-.586A1.935 1.935 0 0 1 2 18V6c0-.55.195-1.02.586-1.414C2.98 4.196 3.449 4 4 4h16c.55 0 1.02.195 1.414.586.39.394.586.863.586 1.414v12c0 .55-.195 1.02-.586 1.414-.394.39-.863.586-1.414.586Zm0-2h16V6H4Zm0 0V6Zm7-5h8V7h-8Zm2-2V9h4v2Zm0 0"></path>
        </svg>`;

    const SVG_EXIT = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15.852 13H19V7h-8v1.148l2 2V9h4v2h-3.148Zm5.921 5.926L20 17.148V6H8.852l-2-2H20c.55 0 1.02.24 1.414.586.39.394.586.863.586 1.414v12c0 .168-.016.328-.05.488-.032.157-.09.305-.177.438Zm-12.199-6.5Zm4.852-.852Zm6.023 11.727L17.15 20H4c-.55 0-1.02-.195-1.414-.586A1.935 1.935 0 0 1 2 18V6c0-.55.195-1.02.586-1.414C2.98 4.196 3.449 4 4 4l2 2H4v12h11.148L.648 3.5l1.426-1.426 19.801 19.801Zm0 0"></path>
        </svg>`;

    function installStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .${WRAPPER_CLASS} {
                position: fixed;
                z-index: 2147483646;
                width: 50px;
                height: 50px;
                pointer-events: none;
                opacity: 0;
                visibility: hidden;
                transition: opacity 120ms ease, visibility 120ms ease;
            }
            .${WRAPPER_CLASS}.quick-pip-visible {
                opacity: 1;
                visibility: visible;
            }
            .${BUTTON_CLASS} {
                all: unset;
                box-sizing: border-box;
                width: 52px;
                height: 52px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: rgba(0, 0, 0, 0.3);
                color: #fff;
                cursor: pointer;
                pointer-events: auto;
                user-select: none;
                -webkit-user-select: none;
            }
            .${BUTTON_CLASS}:hover {
                background: rgba(0, 0, 0, 0.3);
            }
            .${BUTTON_CLASS}:active {
                transform: scale(.96);
            }
            .${BUTTON_CLASS}[data-pip-active="true"] {
                background: rgba(0, 0, 0, 0.3);
            }
            .${BUTTON_CLASS} svg {
                width: 29px;
                height: 29px;
                fill: currentColor;
            }
            .${BUTTON_CLASS} svg path:last-child {
                fill: none;
                stroke: currentColor;
                stroke-width: 1.7;
                stroke-linecap: round;
            }
            @media (prefers-reduced-motion: reduce) {
                .${WRAPPER_CLASS} { transition: none; }
            }
        `;
        document.documentElement.appendChild(style);
    }

    function setButtonState(button, active) {
        button.dataset.pipActive = active ? 'true' : 'false';
        button.innerHTML = active ? SVG_EXIT : SVG_ENTER;
        button.title = active ? 'Выйти из режима Picture-in-Picture' : 'Открыть в Picture-in-Picture';
        button.setAttribute('aria-label', button.title);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    function isVideoUsable(video) {
        return video &&
            video.isConnected &&
            typeof video.requestPictureInPicture === 'function' &&
            Number(video.readyState) >= 2 &&
            !video.ended &&
            Number(video.duration || 0) > 0;
    }

    function positionWrapper(video, wrapper) {
        if (!video.isConnected) {
            wrapper.classList.remove('quick-pip-visible');
            return;
        }

        const rect = video.getBoundingClientRect();
        if (rect.width < 80 || rect.height < 60 || rect.bottom <= 0 || rect.right <= 0 ||
            rect.top >= window.innerHeight || rect.left >= window.innerWidth) {
            wrapper.classList.remove('quick-pip-visible');
            return;
        }

        const right = Math.max(8, window.innerWidth - rect.right + 8);
        wrapper.style.right = `${right}px`;
        wrapper.style.top = `${Math.max(8, rect.top + (rect.height / 2) - 26)}px`;
        wrapper.style.bottom = 'auto';
    }

    function clearHideTimer(record) {
        if (record.hideTimer) {
            window.clearTimeout(record.hideTimer);
            record.hideTimer = 0;
        }
    }

    function scheduleHide(video) {
        const record = tracked.get(video);
        if (!record) return;
        clearHideTimer(record);
        record.hideTimer = window.setTimeout(() => {
            record.hideTimer = 0;
            if (!record.button.matches(':hover')) setVisible(video, false);
        }, HIDE_DELAY);
    }

    function setVisible(video, visible) {
        const record = tracked.get(video);
        if (!record) return;
        positionWrapper(video, record.wrapper);
        record.wrapper.classList.toggle('quick-pip-visible', visible);
        if (visible) scheduleHide(video);
        else clearHideTimer(record);
    }

    async function toggle(video) {
        const button = tracked.get(video)?.button;
        if (!button) return;

        button.disabled = true;
        try {
            const active = document.pictureInPictureElement;
            if (active === video) {
                await document.exitPictureInPicture();
                return;
            }

            if (active) {
                await document.exitPictureInPicture();
            }

            await pip.request(video, {
                allowDisablePictureInPictureOverride: true,
                ensureAutoPipAttr: false,
                compat: false
            });
        } catch (error) {
            // Do not surface noisy site-specific errors. The native PiP API can reject
            // when the browser/user/site does not permit PiP for this video.
            try { button.blur(); } catch (_) { }
            console.debug('[Quick PiP] button request failed', error);
        } finally {
            button.disabled = false;
            updateAllStates();
        }
    }

    function addButton(video) {
        if (!video || tracked.has(video) || !video.isConnected) return;

        const wrapper = document.createElement('div');
        wrapper.className = WRAPPER_CLASS;

        const button = document.createElement('button');
        button.className = BUTTON_CLASS;
        button.type = 'button';
        setButtonState(button, document.pictureInPictureElement === video);
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggle(video);
        });

        wrapper.appendChild(button);
        document.body.appendChild(wrapper);
        wrappers.add(wrapper);
        tracked.set(video, { wrapper, button, over: false, hideTimer: 0 });

        const onPointerEnter = () => {
            const record = tracked.get(video);
            if (!record) return;
            record.over = true;
            clearHideTimer(record);
            setVisible(video, true);
        };
        const onPointerLeave = () => {
            const record = tracked.get(video);
            if (!record) return;
            record.over = false;
            scheduleHide(video);
        };
        const onButtonEnter = () => {
            const record = tracked.get(video);
            if (!record) return;
            record.over = true;
            clearHideTimer(record);
            setVisible(video, true);
        };
        const onButtonLeave = () => {
            const record = tracked.get(video);
            if (!record) return;
            record.over = false;
            scheduleHide(video);
        };
        video.addEventListener('pointerenter', onPointerEnter, { passive: true });
        video.addEventListener('pointerleave', onPointerLeave, { passive: true });
        button.addEventListener('pointerenter', onButtonEnter, { passive: true });
        button.addEventListener('pointerleave', onButtonLeave, { passive: true });
        video.addEventListener('play', () => updateState(video), { passive: true });
        video.addEventListener('pause', () => updateState(video), { passive: true });
        video.addEventListener('emptied', () => removeButton(video), { passive: true });
    }

    function removeButton(video) {
        const record = tracked.get(video);
        if (!record) return;
        clearHideTimer(record);
        record.wrapper.remove();
        wrappers.delete(record.wrapper);
        tracked.delete(video);
    }

    function updateState(video) {
        const record = tracked.get(video);
        if (!record) return;
        const active = document.pictureInPictureElement === video;
        setButtonState(record.button, active);
        positionWrapper(video, record.wrapper);
    }

    function updateAllStates() {
        videoLib.findVideos({ deep: true, minReadyState: 1, visibleOnly: false, playingFirst: true, includeDisabled: true })
            .forEach(video => updateState(video));
    }

    function isNearButton(button, x, y) {
        const rect = button.getBoundingClientRect();
        return x >= rect.left - REVEAL_DISTANCE &&
            x <= rect.right + REVEAL_DISTANCE &&
            y >= rect.top - REVEAL_DISTANCE &&
            y <= rect.bottom + REVEAL_DISTANCE;
    }

    function handlePointerMove(event) {
        const x = event.clientX;
        const y = event.clientY;

        for (const video of document.querySelectorAll('video')) {
            const record = tracked.get(video);
            if (!record || !isVideoUsable(video)) continue;

            if (isNearButton(record.button, x, y)) {
                clearHideTimer(record);
                setVisible(video, true);
            } else if (record.wrapper.classList.contains('quick-pip-visible')) {
                scheduleHide(video);
            }
        }
    }

    let scanTimer = 0;
    function scan() {
        installStyle();
        videoLib.findVideos({ deep: true, minReadyState: 1, visibleOnly: false, playingFirst: true, includeDisabled: true })
            .forEach(video => {
                if (isVideoUsable(video)) addButton(video);
                else if (tracked.has(video)) removeButton(video);
            });
    }

    function scheduleScan() {
        if (scanTimer) return;
        scanTimer = window.setTimeout(() => {
            scanTimer = 0;
            scan();
        }, 120);
    }

    function handlePiPEnter(event) {
        scan();
        updateAllStates();
        if (event && event.target) {
            const record = tracked.get(event.target);
            if (record) setVisible(event.target, false);
        }
    }

    function handlePiPLeave(event) {
        updateAllStates();
        if (event && event.target && tracked.has(event.target)) {
            setVisible(event.target, true);
            scheduleHide(event.target);
        }
    }

    function observe() {
        const observer = new MutationObserver(scheduleScan);
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    installStyle();
    scan();
    observe();

    document.addEventListener('enterpictureinpicture', handlePiPEnter, true);
    document.addEventListener('leavepictureinpicture', handlePiPLeave, true);
    document.addEventListener('pointermove', handlePointerMove, { passive: true, capture: true });

    window.addEventListener('resize', () => {
        videoLib.findVideos({ deep: true, minReadyState: 1, visibleOnly: false, playingFirst: true, includeDisabled: true })
            .forEach(video => {
                const record = tracked.get(video);
                if (record) positionWrapper(video, record.wrapper);
            });
    }, { passive: true });

    window.addEventListener('scroll', () => {
        videoLib.findVideos({ deep: true, minReadyState: 1, visibleOnly: false, playingFirst: true, includeDisabled: true })
            .forEach(video => {
                const record = tracked.get(video);
                if (record) positionWrapper(video, record.wrapper);
            });
    }, { passive: true, capture: true });
})();
