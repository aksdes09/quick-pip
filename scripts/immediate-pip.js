(async () => {
    'use strict';

    const videoLib = window.AutoPipContent && window.AutoPipContent.video;
    const pip = window.AutoPipContent && window.AutoPipContent.pip;
    const path = 'manual';

    try {
        if (!videoLib || !pip) {
            return { ok: false, status: 'failed', reason: 'missing_content_lib', path };
        }

        if (document.pictureInPictureElement) {
            const exited = await pip.exitOwned();
            return {
                ok: exited.reason !== 'pip_not_extension_managed',
                status: exited.exited ? 'toggled_off' : 'skipped',
                reason: exited.reason,
                path,
                video: videoLib.state(document.pictureInPictureElement)
            };
        }

        const stale = document.querySelector('[__pip__]');
        if (stale) {
            pip.cleanupVideo(stale);
            return videoLib.result(true, 'toggled_off', 'stale_marker_removed', path, stale);
        }

        const candidates = videoLib.findVideos({
            deep: true,
            minReadyState: 2,
            visibleOnly: false,
            playingFirst: true,
            includeDisabled: true
        }).filter(video =>
            videoLib.isPlaying(video) ||
            videoLib.isPausedCandidate(video) ||
            (Number(video.readyState) >= 2 && Number(video.duration || 0) > 0 && !video.ended)
        );

        const video = candidates[0] || null;
        if (!video || typeof video.requestPictureInPicture !== 'function') {
            return videoLib.result(false, 'skipped', 'no_video_candidate', path, null);
        }

        await pip.request(video, {
            allowDisablePictureInPictureOverride: true,
            ensureAutoPipAttr: false,
            compat: false
        });
        return videoLib.result(true, 'success', 'requested_picture_in_picture', path, video);
    } catch (error) {
        return {
            ok: false,
            status: 'failed',
            reason: 'request_failed',
            path,
            message: error && error.message ? error.message : String(error),
            name: error && error.name ? error.name : null,
            video: null
        };
    }
})();
