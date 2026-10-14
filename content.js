(() => {
  "use strict";

  const STYLE_ID = "todoist-accent-override";
  const DEFAULTS = { enabled: true, color: "#3b82f6", sourceOverride: "" };
  const FALLBACK_ACCENT = "#dc4c3e"; // Todoist's default red

  // Variables that should keep their meaning even if they're close in hue
  // to the accent (priority flags, overdue dates, errors, project colors...).
  const EXCLUDE =
    /priority|\bp[1-4]\b|-p[1-4]-|danger|error|destruct|alert|overdue|warning|success|deadline|label|project-color|avatar|karma|charcoal/i;

  let state = { ...DEFAULTS };
  const varNames = new Set();
  const fetchedUrls = new Set();
  let lastAccent = null;
  let scanTimer = null;

  // ---------- color helpers ----------
  let probe = null;
  function toRgb(str) {
    if (!str) return null;
    str = String(str).trim();
    if (!str || str.includes("var(") || str.includes("gradient") || str.includes("url(")) return null;
    if (!probe) {
      probe = document.createElement("span");
      probe.style.display = "none";
      document.documentElement.appendChild(probe);
    }
    probe.style.color = "";
    probe.style.color = str;
    if (!probe.style.color) return null;
    const m = getComputedStyle(probe).color.match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    return { r: +m[0], g: +m[1], b: +m[2], a: m[3] !== undefined ? +m[3] : 1 };
  }

  function rgbToHsl({ r, g, b, a }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s, l, a };
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const hueDist = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };
  const key = (c) => `${c.r},${c.g},${c.b},${c.a}`;
  const fmt = ({ h, s, l, a }) =>
    `hsla(${((h % 360) + 360) % 360}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%, ${a})`;

  // ---------- variable discovery ----------
  function collectFromRules(rules) {
    for (const rule of rules) {
      if (rule.style) {
        for (let i = 0; i < rule.style.length; i++) {
          const p = rule.style[i];
          if (p.startsWith("--")) varNames.add(p);
        }
      }
      if (rule.cssRules) collectFromRules(rule.cssRules);
    }
  }

  async function collectVarNames() {
    const unreadable = [];
    const sheets = [...document.styleSheets, ...(document.adoptedStyleSheets || [])];
    for (const sheet of sheets) {
      if (sheet.ownerNode && sheet.ownerNode.id === STYLE_ID) continue;
      try {
        collectFromRules(sheet.cssRules);
      } catch (_) {
        if (sheet.href && !fetchedUrls.has(sheet.href)) unreadable.push(sheet.href);
      }
    }
    // Firefox may also enumerate custom properties on computed style.
    const cs = getComputedStyle(document.documentElement);
    for (let i = 0; i < cs.length; i++) if (cs[i].startsWith("--")) varNames.add(cs[i]);

    await Promise.all(
      unreadable.map(async (url) => {
        fetchedUrls.add(url);
        try {
          const text = await browser.runtime.sendMessage({ type: "fetchCss", url });
          for (const m of (text || "").matchAll(/(--[\w-]+)\s*:/g)) varNames.add(m[1]);
        } catch (_) { /* ignore */ }
      })
    );
  }

  // ---------- scan + apply ----------
  function readValues() {
    // Read from a deep element so theme vars defined below <body> are visible.
    const target =
      document.querySelector("main") ||
      document.querySelector("#content") ||
      document.body ||
      document.documentElement;
    const cs = getComputedStyle(target);
    const values = new Map();
    for (const name of varNames) {
      const rgb = toRgb(cs.getPropertyValue(name));
      if (rgb && rgb.a > 0) values.set(name, rgb);
    }
    return values;
  }

  function detectAccent(values) {
    if (state.sourceOverride) {
      const o = toRgb(state.sourceOverride);
      if (o) return o;
    }
    const tally = (re) => {
      const counts = new Map();
      for (const [name, rgb] of values) {
        if (!re.test(name) || EXCLUDE.test(name)) continue;
        const hsl = rgbToHsl(rgb);
        if (hsl.s < 0.3 || rgb.a < 1) continue;
        const k = key(rgb);
        counts.set(k, { rgb, n: (counts.get(k)?.n || 0) + 1 });
      }
      let best = null;
      for (const v of counts.values()) if (!best || v.n > best.n) best = v;
      return best && best.rgb;
    };
    return (
      tally(/accent/i) ||
      tally(/brand|actionable-primary|primary-(idle|fill)/i) ||
      toRgb(FALLBACK_ACCENT)
    );
  }

  function ensureStyle() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  async function scan() {
    const styleEl = document.getElementById(STYLE_ID);
    if (!state.enabled) {
      if (styleEl) styleEl.remove();
      return;
    }
    await collectVarNames();

    // Read Todoist's own values, not our overrides.
    if (styleEl) styleEl.disabled = true;
    const values = readValues();
    const accent = detectAccent(values);
    if (styleEl) styleEl.disabled = false;

    lastAccent = accent;
    const target = toRgb(state.color);
    if (!accent || !target) return;

    const A = rgbToHsl(accent);
    const T = rgbToHsl(target);
    const lines = [];

    for (const [name, rgb] of values) {
      if (EXCLUDE.test(name)) continue;
      const c = rgbToHsl(rgb);
      if (c.s < 0.25 || hueDist(c.h, A.h) > 18) continue;
      // Shift each accent shade (hover, pressed, tints) by the same offset.
      const next = {
        h: c.h + (T.h - A.h),
        s: clamp(c.s + (T.s - A.s), 0, 1),
        l: clamp(c.l + (T.l - A.l), 0, 1),
        a: c.a,
      };
      lines.push(`  ${name}: ${fmt(next)} !important;`);
    }

    ensureStyle().textContent = lines.length
      ? `:root, :root * {\n${lines.join("\n")}\n}`
      : "";
  }

  function scheduleScan(delay = 400) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, delay);
  }

  // ---------- wiring ----------
  browser.storage.local.get(DEFAULTS).then((s) => {
    state = { ...DEFAULTS, ...s };
    scan();
    setTimeout(scan, 2500); // the app finishes loading styles after idle
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [k, v] of Object.entries(changes)) state[k] = v.newValue;
    scheduleScan(50);
  });

  browser.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "getStatus") {
      const a = lastAccent;
      const hex = a
        ? "#" + [a.r, a.g, a.b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")
        : null;
      return Promise.resolve({ detectedAccent: hex, varCount: varNames.size });
    }
    if (msg && msg.type === "rescan") {
      return scan().then(() => true);
    }
    return false;
  });

  // Theme switches change classes/attributes on html/body; new styles get
  // injected as you navigate the app.
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "attributes") return scheduleScan();
      for (const n of m.addedNodes) {
        if ((n.tagName === "STYLE" || n.tagName === "LINK") && n.id !== STYLE_ID) {
          return scheduleScan(800);
        }
      }
    }
  });
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"],
  });
  const watchHead = () => {
    if (document.head) mo.observe(document.head, { childList: true });
    if (document.body)
      mo.observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme"] });
  };
  watchHead();
})();
