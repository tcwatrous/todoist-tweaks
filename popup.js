const DEFAULTS = { enabled: true, color: "#3b82f6", sourceOverride: "" };
const PRESETS = [
  "#3b82f6", "#0ea5e9", "#14b8a6", "#22c55e",
  "#eab308", "#f97316", "#ec4899", "#8b5cf6",
  "#6366f1", "#64748b", "#111827", "#dc4c3e",
];

const $ = (id) => document.getElementById(id);
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);

function paint(color) {
  $("picker").value = color;
  $("hex").value = color;
  document.documentElement.style.setProperty("--accent", color);
  for (const b of $("swatches").children) b.classList.toggle("on", b.dataset.c === color);
}

function save(patch) {
  return browser.storage.local.set(patch);
}

async function todoistTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab && /todoist\.com/.test(tab.url || "") ? tab : null;
}

async function refreshStatus() {
  const tab = await todoistTab();
  if (!tab) return;
  try {
    const s = await browser.tabs.sendMessage(tab.id, { type: "getStatus" });
    $("status").textContent = s && s.detectedAccent
      ? `Todoist accent detected: ${s.detectedAccent}`
      : "Couldn't detect Todoist's accent yet — try Rescan.";
  } catch (_) {
    $("status").textContent = "Reload the Todoist tab to activate.";
  }
}

(async () => {
  const s = { ...DEFAULTS, ...(await browser.storage.local.get(DEFAULTS)) };

  for (const c of PRESETS) {
    const b = document.createElement("button");
    b.style.background = c;
    b.dataset.c = c;
    b.title = c;
    b.onclick = () => { paint(c); save({ color: c }); };
    $("swatches").appendChild(b);
  }

  paint(s.color);
  $("enabled").checked = s.enabled;
  $("source").value = s.sourceOverride;

  $("picker").addEventListener("input", (e) => { paint(e.target.value); save({ color: e.target.value }); });
  $("hex").addEventListener("input", (e) => {
    let v = e.target.value.trim();
    if (!v.startsWith("#")) v = "#" + v;
    if (isHex(v)) { paint(v.toLowerCase()); save({ color: v.toLowerCase() }); }
  });
  $("enabled").addEventListener("change", (e) => save({ enabled: e.target.checked }));
  $("source").addEventListener("change", (e) => {
    const v = e.target.value.trim();
    save({ sourceOverride: v === "" || isHex(v) ? v : "" });
  });
  $("rescan").addEventListener("click", async () => {
    const tab = await todoistTab();
    if (tab) {
      try { await browser.tabs.sendMessage(tab.id, { type: "rescan" }); } catch (_) {}
    }
    refreshStatus();
  });

  const { whiteIcon } = await browser.storage.local.get({ whiteIcon: true });
  $("whiteIcon").checked = whiteIcon;
  $("whiteIcon").addEventListener("change", (e) => save({ whiteIcon: e.target.checked }));

  refreshStatus();
  setupSounds();
})();

// ---------- complete sound ----------
async function setupSounds() {
  const SD = { sound: "pop", volume: 0.6 };
  const s = { ...SD, ...(await browser.storage.local.get(SD)) };
  const { LIST, play } = globalThis.TA_SOUNDS;
  let ctx = null;
  const preview = (k) => {
    if (k === "off" || k === "todoist") return;
    ctx = ctx || new AudioContext();
    play(k, ctx, $("volume").value / 100);
  };

  const groups = [
    { group: "Basics", items: [["todoist", "Todoist original"], ["off", "Off"]] },
    ...LIST,
  ];
  const buttons = [];
  for (const g of groups) {
    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gap = "10px";
    const label = document.createElement("div");
    label.className = "grp";
    label.textContent = g.group;
    const grid = document.createElement("div");
    grid.className = "sounds";
    for (const [k, name] of g.items) {
      const b = document.createElement("button");
      b.textContent = name;
      b.dataset.k = k;
      b.classList.toggle("on", k === s.sound);
      b.onclick = () => {
        buttons.forEach((x) => x.classList.toggle("on", x === b));
        save({ sound: k });
        preview(k);
      };
      buttons.push(b);
      grid.appendChild(b);
    }
    wrap.append(label, grid);
    $("soundList").appendChild(wrap);
  }

  $("volume").value = Math.round(s.volume * 100);
  $("volume").addEventListener("change", (e) => {
    save({ volume: e.target.value / 100 });
    const on = buttons.find((b) => b.classList.contains("on"));
    if (on) preview(on.dataset.k);
  });
}
