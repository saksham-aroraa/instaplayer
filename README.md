# InstaPlayer v1.1 (unpacked Chrome extension)

A small Manifest V3 extension that adds a floating, modern controller to Instagram videos.

## Features
- Detects the currently visible / playing video.
- Re-detects videos when Instagram replaces them during left/right post navigation.
- Uses MutationObserver to watch DOM changes and video `src`/style/class changes.
- Seek bar, elapsed/total time, play/pause, ±5s and ±10s seeking.
- Playback speed from 0.5× to 3×.
- Custom mute/unmute button (stays in sync with the video's actual muted state).
- Custom fullscreen button (stays in sync with fullscreen changes, including Esc).
- Picture-in-Picture where the browser and media allow it.
- While in PiP, any HTML text tracks that are showing are disabled, then restored when PiP ends.
- Draggable, minimizable floating UI.
- `Alt + Left/Right` seeks by 10 seconds without taking over Instagram's regular arrow navigation.

## What changed in v1.1
- Added mute and fullscreen buttons (both live inside the extension's Shadow DOM, so Instagram's overlay can't intercept them).
- Removed the "Native controls" toggle, which Instagram's overlay made unreliable.
- Text tracks are disabled during PiP and restored afterwards.

## Install / update in Chrome
1. Unzip `InstaPlayer.zip`.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the unzipped `instaplayer` folder (the folder containing `manifest.json`).
6. Refresh the Instagram tab.

Already installed? Replace the files in your existing folder, click **Reload** on the InstaPlayer card in `chrome://extensions`, then refresh Instagram.

## Notes
- The extension requests no special Chrome permissions; its content script runs only on `https://www.instagram.com/*`.
- Fullscreen shows the video element on its own, so Chrome's built-in fullscreen controls appear and the floating InstaPlayer panel is hidden until you exit (press Esc or use the fullscreen control). `Alt + Left/Right` still seeks while in fullscreen.
- Chrome's own Live Captions and translation features are browser-level and cannot be turned off by an extension. The PiP text-track change only affects captions that Instagram attaches to the video as HTML text tracks, and many videos have none.
- Some Instagram videos may expose a limited or delayed seekable range. The seek bar uses the media element's duration when finite, otherwise the last browser-reported seekable range.
- This is a local prototype, not a Chrome Web Store-reviewed release. Instagram can change its DOM and media behavior at any time.
- To remove it, use `chrome://extensions` and click **Remove**.
