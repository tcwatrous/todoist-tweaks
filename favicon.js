// Replaces Todoist's tab icon with the white version, and keeps it that way
// if Todoist swaps its icon back while the app runs.
(() => {
  "use strict";
  const MARK = "data-todoist-tweaks";
  const ICON = browser.runtime.getURL("favicon-white.png");
  let enabled = true;
  let original = null;

  const theirIcons = () =>
    [...document.querySelectorAll('link[rel~="icon"]')].filter((l) => !l.hasAttribute(MARK));

  function apply() {
    if (!document.head) return;
    let ours = document.head.querySelector(`link[${MARK}]`);
    if (!enabled) {
      if (ours) ours.remove();
      theirIcons().forEach((l) => l.removeAttribute("media"));
      return;
    }
    // Park Todoist's icons rather than deleting them, so turning this off restores them.
    for (const l of theirIcons()) {
      if (!original) original = l.href;
      if (l.getAttribute("media") !== "not all") l.setAttribute("media", "not all");
    }
    if (!ours) {
      ours = document.createElement("link");
      ours.setAttribute(MARK, "");
      ours.rel = "icon";
      ours.type = "image/png";
      ours.href = ICON;
      document.head.appendChild(ours);
    } else if (ours !== document.head.lastElementChild && theirIcons().length) {
      document.head.appendChild(ours); // stay last so Firefox prefers ours
    }
  }

  browser.storage.local.get({ whiteIcon: true }).then((s) => {
    enabled = s.whiteIcon;
    apply();
  });
  browser.storage.onChanged.addListener((c, area) => {
    if (area === "local" && "whiteIcon" in c) {
      enabled = c.whiteIcon.newValue;
      apply();
    }
  });

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }).observe(document.head || document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ["href", "rel", "media"],
  });
})();
