// Swaps Todoist's task-complete sound for the one picked in the popup.
// Todoist plays its sound as an <audio> file from /assets/sounds/, so we
// hook HTMLMediaElement.play in the page, mute Todoist's file and play ours.
(() => {
  "use strict";
  const S = globalThis.TA_SOUNDS;
  const page = window.wrappedJSObject;
  if (!S || !page || typeof exportFunction !== "function") return;

  const DEFAULTS = { sound: "pop", volume: 0.6, completionSrc: "" };
  let state = { ...DEFAULTS };
  browser.storage.local.get(DEFAULTS).then((s) => { state = { ...DEFAULTS, ...s }; });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const k of Object.keys(DEFAULTS)) if (k in changes) state[k] = changes[k].newValue;
  });

  // A click on a task's complete checkbox is the signal that the next
  // sound from /assets/sounds/ is the completion sound.
  const CHECKBOX =
    '[data-action-hint="task-complete"], [role="checkbox"][aria-label*="complete" i]';
  let lastCompleteClick = 0;
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest(CHECKBOX)) lastCompleteClick = Date.now();
  }, true);

  const isTodoistSound = (src) => /\/assets\/sounds\//.test(src || "");

  function shouldReplace(src) {
    if (state.sound === "todoist" || !isTodoistSound(src)) return false;
    if (Date.now() - lastCompleteClick < 1500) {
      // Learn the current file name (it changes when Todoist updates), so
      // completions from the keyboard or elsewhere get swapped too.
      if (src !== state.completionSrc) {
        state.completionSrc = src;
        browser.storage.local.set({ completionSrc: src });
      }
      return true;
    }
    return src === state.completionSrc;
  }

  let ctx = null;
  function playOurs() {
    if (state.sound === "off") return;
    try {
      ctx = ctx || new AudioContext();
      S.play(state.sound, ctx, state.volume);
    } catch (_) { /* audio blocked; stay silent */ }
  }

  const mutedByUs = new WeakSet();
  const proto = page.HTMLMediaElement.prototype;
  const originalPlay = proto.play;

  exportFunction(function () {
    try {
      const src = this.currentSrc || this.src;
      if (shouldReplace(src)) {
        this.muted = true;
        mutedByUs.add(this);
        playOurs();
      } else if (mutedByUs.has(this)) {
        this.muted = false;
        mutedByUs.delete(this);
      }
    } catch (_) { /* never break Todoist's own playback */ }
    return originalPlay.call(this);
  }, proto, { defineAs: "play" });
})();
