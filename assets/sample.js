/* Invented sample data for demos and the prototype gallery only (admin.html#demo).
   Never written to storage. */
window.EHP_SAMPLE = (() => {
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const R = rng(20261028);
  const pick = a => a[Math.floor(R() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = Date.now();
  const refs = [
    { code: "UM-NOV", label: "Sample · Universiti Malaya workshop", createdAt: now - 20 * 864e5 },
    { code: "TAYLORS-OCT", label: "Sample · Taylor's student club", createdAt: now - 18 * 864e5 },
    { code: "RUANG-IG", label: "Sample · Ruang Instagram post", createdAt: now - 12 * 864e5 },
  ];
  const hard = { s04: .45, s07: .5, s15: .55, s18: .6, s09: .62 };
  const lines = [
    "Next time my parents compare me, I'll say how it feels instead of walking off.",
    "Text my friend first instead of waiting.",
    "Pause and breathe before replying in the group chat.",
    "Ask my lecturer which part to fix first.",
    "Tell someone when I'm not OK, even a little.",
    "Own it when I'm late, no long story.",
    "Close the app when I start comparing.",
    "Notice when I'm defending and ask a question instead.",
  ];
  const { SCENARIOS, LEVELS, ITEMS, AGES } = window.EHP;
  const sessions = [];
  const shareCodes = [];
  for (let i = 0; i < 68; i++) {
    const created = now - Math.floor(R() * 21 * 864e5);
    let ref = R() < .78 ? pick(refs).code : "";
    if (shareCodes.length && R() < .18) ref = pick(shareCodes);
    const share = "F" + Math.floor(R() * 36 ** 5).toString(36).toUpperCase().padStart(5, "X");
    shareCodes.push(share);
    const pm = clamp(Math.round(3 + R() * 6), 1, 10);
    const pre = { mood: pm, items: {}, at: created + 60e3 };
    ITEMS.forEach(it => pre.items[it.k] = clamp(Math.round(2 + R() * 2.4), 1, 5));
    const runs = [];
    const nRuns = R() < .08 ? 0 : 1 + Math.floor(R() * 3);
    for (let r = 0; r < nRuns; r++) {
      const choices = [];
      const n = 3 + Math.floor(R() * 10);
      for (let c = 0; c < n; c++) {
        const sc = pick(SCENARIOS); const p = (hard[sc.id] || .78) + r * .04;
        const good = R() < p; const timedOut = !good && R() < .3;
        choices.push({ s: sc.id, good, timedOut, ms: Math.round(900 + R() * 3600) });
      }
      const xp = Math.round(200 + n * 160 + R() * 900 + r * 300);
      let level = 5; LEVELS.forEach(L => { if (xp >= L.xp) level = L.n; });
      runs.push({ at: created + 120e3 + r * 180e3, xp, level, durationS: 40 + n * 11, aboveRatio: +(.45 + R() * .45).toFixed(3), hits: Math.floor(R() * 6), orbs: Math.floor(R() * 9), flows: Math.floor(R() * 3), observes: Math.floor(R() * 3), bestStreak: Math.floor(R() * 6), choices });
    }
    let post = null;
    if (nRuns && R() < .74) {
      post = { mood: clamp(pm + Math.round(R() * 2.2 - .3), 1, 10), items: {}, rec: clamp(Math.round(6 + R() * 4.5), 0, 10), choose: R() < .6 ? pick(lines) : "", at: created + 700e3 };
      ITEMS.forEach(it => post.items[it.k] = clamp(pre.items[it.k] + (R() < .55 ? 1 : 0) - (R() < .08 ? 1 : 0), 1, 5));
    }
    sessions.push({ id: "sample" + i.toString().padStart(4, "0"), v: 1, createdAt: created, updatedAt: created + 800e3, ref, shareCode: share, age: pick(AGES.slice(1, 4)), consent: true, pre, runs, post, device: R() < .7 ? "touch" : "desktop" });
  }
  return { sessions, refs };
})();
