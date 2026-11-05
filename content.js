(() => {
  "use strict";

  // Prevent duplicate initialization if the content script is ever injected twice.
  if (window.__instaPlayerLoaded) return;
  window.__instaPlayerLoaded = true;

  const HOST_ID = "instaplayer-extension-host";
  const state = {
    video: null,
    boundVideo: null,
    minimized: false,
    scrubbing: false,
    observer: null,
    scanQueued: false,
    lastUrl: location.href
  };

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "all:initial; position:fixed; z-index:2147483647; right:22px; bottom:22px;";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .panel {
        width: min(370px, calc(100vw - 28px));
        color: #f7f7fb;
        background: rgba(19, 20, 29, .94);
        border: 1px solid rgba(255,255,255,.13);
        border-radius: 18px;
        box-shadow: 0 18px 55px rgba(0,0,0,.38);
        backdrop-filter: blur(22px);
        -webkit-backdrop-filter: blur(22px);
        overflow: hidden;
        font: 13px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: .01em;
      }
      .top {
        display:flex; align-items:center; justify-content:space-between;
        padding: 13px 15px 9px; cursor: grab; user-select:none;
      }
      .brand { display:flex; align-items:center; gap:9px; font-weight:700; font-size:13px; }
      .logo {
        width:25px;height:25px;border-radius:9px;display:grid;place-items:center;
        background:linear-gradient(135deg,#ff6b9a,#a855f7 58%,#6366f1);
        box-shadow:0 3px 12px rgba(168,85,247,.32);font-size:14px;
      }
      .status { color:#a7a9b8;font-size:11px;font-weight:500; }
      .top-actions { display:flex;gap:6px; }
      button, select { font:inherit; }
      button {
        color:inherit; border:0; cursor:pointer; display:grid; place-items:center;
        background:rgba(255,255,255,.09); border-radius:10px;
        transition:background .15s, transform .15s;
      }
      button:hover { background:rgba(255,255,255,.17); }
      button:active { transform:scale(.95); }
      .icon-btn { width:27px;height:27px;font-size:15px;color:#d8d9e2; }
      .body { padding: 2px 15px 14px; }
      .times { display:flex;justify-content:space-between;color:#c4c5d0;font-variant-numeric:tabular-nums;font-size:11px;margin: 3px 1px 7px; }
      input[type=range] {
        width:100%; margin:0; accent-color:#d879f7; cursor:pointer;
      }
      .seek-wrap { padding: 2px 0 9px; }
      .transport { display:flex;align-items:center;justify-content:space-between;gap:7px; }
      .transport button { height:35px; min-width:37px; padding:0 9px; font-size:12px; }
      .transport .main { width:44px;height:40px;border-radius:13px;background:linear-gradient(135deg,#d946ef,#8b5cf6);font-size:17px; }
      .transport .main:hover { background:linear-gradient(135deg,#e879f9,#a78bfa); }
      .subrow { display:flex;align-items:center;justify-content:space-between;margin-top:12px;gap:10px; }
      .speed-group { display:flex;align-items:center;gap:7px;color:#aeb0bd;font-size:11px; }
      select {
        color:#f4f4f7;background:#2b2c39;border:1px solid rgba(255,255,255,.12);
        border-radius:8px;padding:5px 8px;outline:none;cursor:pointer;
      }
      .tools { display:flex;gap:6px; }
      .tool { height:29px;min-width:31px;padding:0 9px;font-size:11px;color:#d8d9e2; }
      .footer { margin-top:10px;color:#777b8d;font-size:10px;display:flex;justify-content:space-between; }
      .hidden { display:none; }
      .minimized { width:190px; }
      .minimized .body { display:none; }
      .minimized .top { padding:10px 12px; }
      .minimized .status { display:none; }
      .no-video { color:#aeb0bd;font-size:12px;padding:5px 0 3px; }
      .pip-on { color:#f0abfc; }
      .muted-on { color:#fca5a5; }
      @media (max-width:480px) { .panel { width:calc(100vw - 24px); } }
    </style>
    <section class="panel" part="panel">
      <header class="top" id="drag">
        <div class="brand"><span class="logo">▶</span><span>InstaPlayer</span><span class="status" id="status">Detecting video…</span></div>
        <div class="top-actions">
          <button class="icon-btn" id="min" title="Minimize">−</button>
          <button class="icon-btn" id="close" title="Hide controller">×</button>
        </div>
      </header>
      <div class="body" id="body">
        <div class="no-video hidden" id="empty">Waiting for an Instagram video…</div>
        <div id="controls">
          <div class="seek-wrap">
            <div class="times"><span id="current">0:00</span><span id="duration">0:00</span></div>
            <input id="seek" type="range" min="0" max="1000" value="0" aria-label="Seek video">
          </div>
          <div class="transport">
            <button id="back" title="Back 10 seconds">−10s</button>
            <button id="rewind" title="Back 5 seconds">↶ 5</button>
            <button class="main" id="play" title="Play or pause">▶</button>
            <button id="forward" title="Forward 5 seconds">5 ↷</button>
            <button id="skip" title="Forward 10 seconds">+10s</button>
          </div>
          <div class="subrow">
            <label class="speed-group">Speed
              <select id="speed" aria-label="Playback speed">
                <option value="0.5">0.5×</option>
                <option value="0.75">0.75×</option>
                <option value="1" selected>1×</option>
                <option value="1.25">1.25×</option>
                <option value="1.5">1.5×</option>
                <option value="1.75">1.75×</option>
                <option value="2">2×</option>
                <option value="2.5">2.5×</option>
                <option value="3">3×</option>
              </select>
            </label>
            <div class="tools">
              <button class="tool" id="pip" title="Picture-in-Picture">▣ PiP</button>
              <button class="tool" id="mute" title="Mute" aria-label="Mute or unmute">🔊</button>
              <button class="tool" id="fullscreen" title="Fullscreen" aria-label="Toggle fullscreen">⛶</button>
            </div>
          </div>
          <div class="footer"><span id="video-state">Ready</span><span>Alt + ← / → to seek</span></div>
        </div>
      </div>
    </section>
  `;

  const $ = (id) => shadow.getElementById(id);
  const panel = shadow.querySelector(".panel");

  function fmt(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  }

  function getTimeline(video) {
    if (!video) return null;
    const duration = video.duration;
    if (Number.isFinite(duration) && duration > 0) {
      return { start: 0, end: duration };
    }
    try {
      if (video.seekable && video.seekable.length) {
        const i = video.seekable.length - 1;
        const start = video.seekable.start(i);
        const end = video.seekable.end(i);
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
          return { start, end };
        }
      }
    } catch (_) {}
    return null;
  }

  function visible(video) {
    if (!video.isConnected) return false;
    const r = video.getBoundingClientRect();
    const style = getComputedStyle(video);
    return r.width > 80 && r.height > 60 &&
      style.display !== "none" && style.visibility !== "hidden" &&
      Number(style.opacity) > 0;
  }

  function chooseVideo() {
    const videos = [...document.querySelectorAll("video")].filter(visible);
    if (!videos.length) return null;

    // Prefer a currently playing video, then the largest visible video.
    const playing = videos.filter(v => !v.paused && !v.ended);
    const pool = playing.length ? playing : videos;
    pool.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (br.width * br.height) - (ar.width * ar.height);
    });
    return pool[0] || null;
  }

  function updateUI() {
    const v = state.video;
    if (!v || !v.isConnected) {
      $("status").textContent = "No active video";
      $("empty").classList.remove("hidden");
      $("controls").classList.add("hidden");
      return;
    }
    $("empty").classList.add("hidden");
    $("controls").classList.remove("hidden");
    const timeline = getTimeline(v);
    const current = Number.isFinite(v.currentTime) ? v.currentTime : 0;
    $("current").textContent = fmt(current);
    $("duration").textContent = timeline ? fmt(timeline.end - timeline.start) : "—:—";
    if (!state.scrubbing) {
      $("seek").value = timeline
        ? Math.max(0, Math.min(1000, ((current - timeline.start) / (timeline.end - timeline.start)) * 1000))
        : 0;
    }
    $("play").textContent = v.paused ? "▶" : "Ⅱ";
    $("play").title = v.paused ? "Play" : "Pause";
    $("speed").value = String(v.playbackRate || 1);
    $("status").textContent = v.paused ? "Paused" : "Playing";
    $("video-state").textContent = v.readyState >= 2 ? "Video ready" : "Loading video…";
    $("pip").classList.toggle("pip-on", document.pictureInPictureElement === v);

    // Mute button mirrors the real element state, however it was changed.
    const silent = Boolean(v.muted) || v.volume === 0;
    $("mute").textContent = silent ? "🔇" : "🔊";
    $("mute").title = silent ? "Unmute" : "Mute";
    $("mute").classList.toggle("muted-on", silent);

    // Fullscreen button mirrors document fullscreen state.
    const isFullscreen = document.fullscreenElement === v;
    $("fullscreen").classList.toggle("pip-on", isFullscreen);
    $("fullscreen").title = isFullscreen ? "Exit fullscreen" : "Fullscreen";
  }

  function seekToFraction(fraction) {
    const v = state.video;
    const timeline = getTimeline(v);
    if (!v || !timeline) return;
    const target = timeline.start + Math.max(0, Math.min(1, fraction)) * (timeline.end - timeline.start);
    try { v.currentTime = target; } catch (err) {
      $("video-state").textContent = "This segment isn't seekable";
    }
    updateUI();
  }

  function seekBy(delta) {
    const v = state.video;
    if (!v) return;
    const timeline = getTimeline(v);
    if (!timeline) return;
    try {
      v.currentTime = Math.max(timeline.start, Math.min(timeline.end, v.currentTime + delta));
    } catch (_) {}
    updateUI();
  }

  // ---- HTML text tracks while in Picture-in-Picture ----
  // Only affects <track>/video.textTracks. Chrome's own Live Captions and
  // translation are browser-level and cannot be controlled from a page.
  const savedTrackModes = new Map(); // TextTrack -> original mode

  function disableTextTracksForPip(video) {
    try {
      const tracks = video && video.textTracks;
      if (!tracks) return;
      for (const track of Array.from(tracks)) {
        if (track.mode !== "disabled" && !savedTrackModes.has(track)) {
          savedTrackModes.set(track, track.mode);
          track.mode = "disabled";
        }
      }
    } catch (_) {}
  }

  function restoreTextTracks() {
    for (const [track, mode] of savedTrackModes) {
      try {
        // Leave it alone if something else already changed it since we disabled it.
        if (track.mode === "disabled") track.mode = mode;
      } catch (_) {}
    }
    savedTrackModes.clear();
  }

  function onEnterPip(e) {
    disableTextTracksForPip(e.target);
    updateUI();
  }

  function onLeavePip() {
    restoreTextTracks();
    updateUI();
  }

  const eventNames = [
    "timeupdate", "durationchange", "loadedmetadata", "loadeddata",
    "play", "pause", "ended", "seeking", "seeked", "ratechange",
    "emptied", "waiting", "canplay", "volumechange"
  ];

  function unbindVideo() {
    if (!state.boundVideo) return;
    for (const name of eventNames) {
      state.boundVideo.removeEventListener(name, updateUI);
    }
    state.boundVideo.removeEventListener("enterpictureinpicture", onEnterPip);
    state.boundVideo.removeEventListener("leavepictureinpicture", onLeavePip);
    restoreTextTracks();
    state.boundVideo = null;
  }

  function bindVideo(video) {
    if (video === state.boundVideo) {
      state.video = video;
      updateUI();
      return;
    }
    unbindVideo();
    state.video = video;
    state.boundVideo = video;
    if (video) {
      for (const name of eventNames) video.addEventListener(name, updateUI);
      video.addEventListener("enterpictureinpicture", onEnterPip);
      video.addEventListener("leavepictureinpicture", onLeavePip);
      $("speed").value = String(video.playbackRate || 1);
      // If this video is already in PiP when we bind, apply the same handling.
      if (document.pictureInPictureElement === video) disableTextTracksForPip(video);
    }
    updateUI();
  }

  function scan() {
    state.scanQueued = false;
    const next = chooseVideo();
    if (next !== state.video || (state.video && !state.video.isConnected)) {
      bindVideo(next);
    } else {
      updateUI();
    }
  }

  function queueScan() {
    if (state.scanQueued) return;
    state.scanQueued = true;
    requestAnimationFrame(scan);
  }

  // Watch for Instagram replacing videos, changing src, or rebuilding player DOM.
  state.observer = new MutationObserver((mutations) => {
    let relevant = false;
    const containsVideo = (node) =>
      node instanceof HTMLVideoElement ||
      (node instanceof Element && Boolean(node.querySelector("video")));

    for (const m of mutations) {
      if (m.type === "childList") {
        if ([...m.addedNodes, ...m.removedNodes].some(containsVideo) ||
            (state.video && !state.video.isConnected)) {
          relevant = true;
          break;
        }
      } else if (m.type === "attributes" && m.target instanceof HTMLVideoElement) {
        relevant = true;
        break;
      }
    }
    if (relevant) queueScan();
  });
  state.observer.observe(document.documentElement, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ["src", "style", "class"]
  });

  // Also handle History API / URL changes; DOM observation remains the primary signal.
  window.addEventListener("popstate", queueScan);
  window.addEventListener("hashchange", queueScan);

  $("seek").addEventListener("pointerdown", () => { state.scrubbing = true; });
  $("seek").addEventListener("input", e => {
    state.scrubbing = true;
    seekToFraction(Number(e.target.value) / 1000);
  });
  $("seek").addEventListener("change", () => {
    state.scrubbing = false;
    updateUI();
  });
  $("seek").addEventListener("pointerup", () => {
    state.scrubbing = false;
    updateUI();
  });

  $("play").addEventListener("click", async () => {
    const v = state.video;
    if (!v) return;
    try {
      if (v.paused) await v.play();
      else v.pause();
    } catch (_) {
      $("video-state").textContent = "Playback was blocked";
    }
    updateUI();
  });
  $("back").addEventListener("click", () => seekBy(-10));
  $("rewind").addEventListener("click", () => seekBy(-5));
  $("forward").addEventListener("click", () => seekBy(5));
  $("skip").addEventListener("click", () => seekBy(10));

  $("speed").addEventListener("change", e => {
    if (state.video) state.video.playbackRate = Number(e.target.value);
    updateUI();
  });

  $("pip").addEventListener("click", async () => {
    const v = state.video;
    if (!v) return;
    try {
      if (document.pictureInPictureElement === v) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled && v.requestPictureInPicture) await v.requestPictureInPicture();
      else $("video-state").textContent = "PiP isn't available for this video";
    } catch (_) {
      $("video-state").textContent = "PiP unavailable";
    }
    updateUI();
  });

  $("mute").addEventListener("click", () => {
    const v = state.video;
    if (!v) return;
    try {
      if (v.muted || v.volume === 0) {
        v.muted = false;
        if (v.volume === 0) v.volume = 1; // Unmuting at zero volume would stay silent.
      } else {
        v.muted = true;
      }
    } catch (_) {
      $("video-state").textContent = "Couldn't change volume";
    }
    updateUI();
  });

  $("fullscreen").addEventListener("click", async () => {
    const v = state.video;
    if (!v) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (v.requestFullscreen) {
        await v.requestFullscreen();
      } else {
        $("video-state").textContent = "Fullscreen isn't available";
      }
    } catch (_) {
      $("video-state").textContent = "Fullscreen unavailable";
    }
    updateUI();
  });

  // Keep the fullscreen button accurate when fullscreen is entered/exited any way (e.g. Esc).
  document.addEventListener("fullscreenchange", updateUI);
  document.addEventListener("fullscreenerror", () => {
    $("video-state").textContent = "Fullscreen was blocked";
  });

  $("min").addEventListener("click", () => {
    state.minimized = !state.minimized;
    panel.classList.toggle("minimized", state.minimized);
    $("min").textContent = state.minimized ? "+" : "−";
  });
  $("close").addEventListener("click", () => {
    host.remove();
    state.observer?.disconnect();
    unbindVideo();
    window.__instaPlayerLoaded = false;
  });

  // Drag the floating panel by its header.
  let drag = null;
  $("drag").addEventListener("pointerdown", e => {
    if (e.target.closest("button")) return;
    const rect = host.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
    $("drag").setPointerCapture(e.pointerId);
    $("drag").style.cursor = "grabbing";
  });
  $("drag").addEventListener("pointermove", e => {
    if (!drag) return;
    const left = Math.max(8, Math.min(innerWidth - host.offsetWidth - 8, drag.left + e.clientX - drag.x));
    const top = Math.max(8, Math.min(innerHeight - host.offsetHeight - 8, drag.top + e.clientY - drag.y));
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
    host.style.right = "auto";
    host.style.bottom = "auto";
  });
  $("drag").addEventListener("pointerup", () => {
    drag = null;
    $("drag").style.cursor = "grab";
  });
  $("drag").addEventListener("pointercancel", () => { drag = null; });

  // Alt + arrows seek without hijacking Instagram's normal left/right navigation.
  document.addEventListener("keydown", e => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.("input, textarea, select, [contenteditable=true]")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); seekBy(-10); }
    if (e.key === "ArrowRight") { e.preventDefault(); seekBy(10); }
  }, true);

  // Re-scan when the user navigates between posts and when videos are inserted later.
  queueScan();
  window.addEventListener("resize", queueScan, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) queueScan();
  });
})();
