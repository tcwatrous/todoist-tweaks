// Fetches cross-origin stylesheets the content script can't read directly,
// so it can find every CSS variable Todoist defines.
browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "fetchCss" && typeof msg.url === "string") {
    return fetch(msg.url, { credentials: "omit" })
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => "");
  }
  return false;
});
