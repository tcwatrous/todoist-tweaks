// Shared sound library, used by the popup (previews) and the Todoist page.
(() => {
  const LIST = [
    { group: "Soft and minimal", items: [
      ["pop", "Soft pop"], ["tick", "Wood tick"], ["thunk", "Low thunk"], ["bubble", "Bubble rise"],
    ]},
    { group: "Bright and chimey", items: [
      ["ding", "Glass ding"], ["chime", "Two-note chime"], ["kalimba", "Kalimba pluck"], ["bell", "Desk bell"],
    ]},
    { group: "Playful and rewarding", items: [
      ["coin", "Coin"], ["sparkle", "Sparkle"], ["marimba", "Marimba duo"], ["swoosh", "Swoosh"],
    ]},
  ];

  function kit(ctx, vol) {
    const tone = (f, t, d, type = "sine", g = 0.4, f2) => {
      const o = ctx.createOscillator(), a = ctx.createGain(), n = ctx.currentTime + t;
      o.type = type;
      o.frequency.setValueAtTime(f, n);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, n + d * 0.8);
      a.gain.setValueAtTime(0, n);
      a.gain.linearRampToValueAtTime(g * vol, n + 0.005);
      a.gain.exponentialRampToValueAtTime(0.0001, n + d);
      o.connect(a).connect(ctx.destination);
      o.start(n);
      o.stop(n + d + 0.05);
    };
    const noise = (t, d, f, q = 1, g = 0.4, f2) => {
      const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * d), ctx.sampleRate);
      const x = b.getChannelData(0);
      for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), a = ctx.createGain();
      const n = ctx.currentTime + t;
      s.buffer = b;
      bp.type = "bandpass";
      bp.Q.value = q;
      bp.frequency.setValueAtTime(f, n);
      if (f2) bp.frequency.exponentialRampToValueAtTime(f2, n + d);
      a.gain.setValueAtTime(g * vol, n);
      a.gain.exponentialRampToValueAtTime(0.0001, n + d);
      s.connect(bp).connect(a).connect(ctx.destination);
      s.start(n);
    };
    return { tone, noise };
  }

  const DEF = {
    pop:     ({ tone }) => tone(900, 0, 0.12, "sine", 0.5, 260),
    tick:    ({ noise }) => noise(0, 0.04, 2500, 4, 0.7),
    thunk:   ({ tone, noise }) => { tone(170, 0, 0.18, "sine", 0.7, 90); noise(0, 0.03, 800, 1, 0.3); },
    bubble:  ({ tone }) => tone(380, 0, 0.14, "sine", 0.45, 1300),
    ding:    ({ tone }) => { tone(1568, 0, 1.1, "sine", 0.3); tone(3920, 0, 0.5, "sine", 0.06); },
    chime:   ({ tone }) => { tone(1047, 0, 0.5, "sine", 0.3); tone(1568, 0.11, 0.8, "sine", 0.3); },
    kalimba: ({ tone }) => { tone(784, 0, 0.6, "sine", 0.4); tone(2117, 0, 0.15, "sine", 0.12); },
    bell:    ({ tone, noise }) => { tone(2637, 0, 1.2, "sine", 0.2); tone(3951, 0, 0.6, "sine", 0.08); noise(0, 0.02, 5000, 2, 0.2); },
    coin:    ({ tone }) => { tone(988, 0, 0.08, "square", 0.12); tone(1319, 0.08, 0.35, "square", 0.12); },
    sparkle: ({ tone }) => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.06, 0.35, "triangle", 0.22)),
    marimba: ({ tone }) => {
      tone(659, 0, 0.25, "sine", 0.45); tone(2636, 0, 0.05, "sine", 0.1);
      tone(988, 0.1, 0.3, "sine", 0.45); tone(3952, 0.1, 0.05, "sine", 0.1);
    },
    swoosh:  ({ noise }) => noise(0, 0.35, 400, 2, 0.5, 4000),
  };

  function play(key, ctx, vol) {
    const fn = DEF[key];
    if (!fn || !ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    fn(kit(ctx, clampVol(vol)));
  }
  const clampVol = (v) => Math.min(1, Math.max(0, Number.isFinite(+v) ? +v : 0.6));

  globalThis.TA_SOUNDS = { LIST, play, has: (k) => k in DEF };
})();
