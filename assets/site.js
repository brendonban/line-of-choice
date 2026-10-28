(() => {
  "use strict";
  const { ITEMS, SCALE, AGES, LEVELS } = window.EHP;
  const $ = id => document.getElementById(id);
  const PAGES = ["home", "play", "how", "support"];
  const SKEY = "ehp_session", RKEY = "ehp_ref";
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  function rid(n, chars = "abcdefghijklmnopqrstuvwxyz0123456789") {
    const a = new Uint32Array(n); (window.crypto || window.msCrypto).getRandomValues(a);
    return [...a].map(x => chars[x % chars.length]).join("");
  }

  /* ---------- referral from link ---------- */
  try {
    const p = new URLSearchParams(location.search).get("ref");
    if (p) lsSet(RKEY, p.trim().toUpperCase().slice(0, 24));
  } catch (e) {}

  /* ---------- routing ---------- */
  function route() {
    const h = (location.hash || "#home").slice(1);
    if (h.startsWith("demo-")) return demo(h.slice(5));
    const page = PAGES.includes(h) ? h : "home";
    document.querySelectorAll("main > [data-page]").forEach(s => s.hidden = s.dataset.page !== page);
    document.querySelectorAll(".nav a").forEach(a => { if (a.dataset.page === page) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (page === "play") renderPlay(); else Game.hide();
    if (PAGES.includes(h)) window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  /* ---------- hero: drag the dot above the line ---------- */
  (function hero() {
    const loc = $("loc"), knob = $("locKnob"), tether = $("locTether"), hint = $("locHint"), cap = $("locCaption");
    const LINE = 79, UP = 18, DOWN = 128;
    let top = DOWN, dragging = false, moved = false, startY = 0, startTop = 0;
    function place(t, animate) {
      top = Math.max(UP, Math.min(DOWN, t));
      knob.style.transition = tether.style.transition = animate ? "top .25s ease, height .25s ease" : "none";
      knob.style.top = top + "px";
      const c = top + 22;
      tether.style.height = Math.max(0, c - 22 - LINE) + "px";
      hint.style.top = (top + 50) + "px";
      const up = c < LINE;
      loc.classList.toggle("is-up", up);
      knob.setAttribute("aria-pressed", String(up));
      hint.textContent = up ? "above the line" : "drag me up";
      cap.innerHTML = up
        ? "<b>Above the line.</b> You noticed, paused, and chose. That’s personal responsibility: owning your response, not the situation."
        : "<b>Below the line.</b> Blame, defend, deny and justify are automatic, and human. Noticing them is the first step back up.";
    }
    knob.addEventListener("pointerdown", e => { dragging = true; moved = false; startY = e.clientY; startTop = top; knob.setPointerCapture(e.pointerId); });
    knob.addEventListener("pointermove", e => { if (!dragging) return; if (Math.abs(e.clientY - startY) > 3) moved = true; place(startTop + e.clientY - startY, false); });
    knob.addEventListener("pointerup", () => { if (!dragging) return; dragging = false; if (moved) place(top + 22 < LINE ? UP : DOWN, true); });
    knob.addEventListener("click", () => { if (!moved) place(top === UP ? DOWN : UP, true); moved = false; });
    place(DOWN, false);
  })();

  /* ---------- need to talk ---------- */
  const talkBtn = $("talkBtn"), sheet = $("talkSheet");
  function setSheet(open) { sheet.hidden = !open; talkBtn.setAttribute("aria-expanded", String(open)); if (open) $("talkClose").focus(); }
  talkBtn.addEventListener("click", () => setSheet(sheet.hidden));
  $("talkClose").addEventListener("click", () => { setSheet(false); talkBtn.focus(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !sheet.hidden) { setSheet(false); talkBtn.focus(); } });

  /* ---------- session ---------- */
  let sess = null;
  try { sess = JSON.parse(lsGet(SKEY)); } catch (e) { sess = null; }
  function persist() { if (!window.EHP_DEMO) lsSet(SKEY, JSON.stringify(sess)); }
  function newSession() {
    return {
      id: rid(16), v: 1, createdAt: Date.now(), ref: "", shareCode: "F" + rid(5, "ABCDEFGHJKMNPQRSTUVWXYZ23456789"),
      age: "", consent: false, pre: null, runs: [], post: null,
      device: (window.matchMedia && matchMedia("(pointer: coarse)").matches) ? "touch" : "desktop",
    };
  }
  async function save() { persist(); await Store.saveSession(sess); }
  let careShown = false;

  function currentStep() {
    if (!sess || !sess.consent) return "intro";
    if (!sess.pre) return "pre";
    if (sess.post) return "done";
    if (sess.pre.mood <= 3 && !careShown && !sess.runs.length) return "care";
    return "game";
  }
  let forced = null;
  function renderPlay() {
    const step = forced || currentStep(); forced = null;
    ["intro", "pre", "care", "game", "post", "done"].forEach(s => $("st-" + s).hidden = s !== step);
    const stepKey = step === "care" ? "pre" : step;
    document.querySelectorAll("#steps span").forEach(s => s.classList.toggle("on", s.dataset.s === stepKey));
    if (step === "game") { Game.finishLabel = sess.post ? "See my results" : "Finish and reflect"; Game.show(); } else Game.hide();
    if (step === "intro") fillIntro();
    if (step === "done") fillDone();
  }
  function go(step) { forced = step; if (location.hash !== "#play") location.hash = "#play"; else renderPlay(); }

  /* ---------- intro ---------- */
  const ageSel = $("ageInput");
  ageSel.innerHTML = '<option value="">Choose…</option>' + AGES.map(a => `<option>${a}</option>`).join("");
  function fillIntro() {
    const r = (sess && sess.ref) || lsGet(RKEY) || "";
    if (r && !$("refInput").value) { $("refInput").value = r; checkRef(); }
  }
  let refTimer = 0;
  async function checkRef() {
    const code = $("refInput").value.trim().toUpperCase(); const msg = $("refMsg");
    if (!code) { msg.className = "hint-s"; msg.textContent = "Got a code from your workshop or a friend? Enter it here."; return; }
    const r = await Store.checkRef(code);
    if (r.valid) { msg.className = "ok-s"; msg.textContent = r.kind === "friend" ? "Code recognised: invited by a friend." : `Code recognised${r.label ? ": " + r.label : ""}.`; }
    else { msg.className = "hint-s"; msg.textContent = "We don’t recognise this code. You can still continue and it will be saved."; }
  }
  $("refInput").addEventListener("input", () => { clearTimeout(refTimer); refTimer = setTimeout(checkRef, 450); });
  $("introForm").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("introErr");
    if (!ageSel.value) { err.textContent = "Please choose your age range."; err.hidden = false; ageSel.focus(); return; }
    if (!$("consent").checked) { err.textContent = "Please tick the box to agree before continuing."; err.hidden = false; $("consent").focus(); return; }
    err.hidden = true;
    sess = sess && !sess.pre ? sess : newSession();
    sess.ref = $("refInput").value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
    if (sess.ref) lsSet(RKEY, sess.ref);
    sess.age = ageSel.value; sess.consent = true;
    await save(); go("pre");
  });

  /* ---------- survey builders ---------- */
  function buildMood(el, prefix) {
    const name = prefix + "-" + el.dataset.name, from = +(el.dataset.from || 1), to = 10;
    let h = ""; for (let i = from; i <= to; i++) h += `<label><input type="radio" name="${name}" value="${i}" aria-label="${i}"><span>${i}</span></label>`;
    el.innerHTML = h;
  }
  function buildItems(el, prefix) {
    el.innerHTML = ITEMS.map(it => `<div class="scale-q" role="radiogroup" aria-label="${it.t}"><p>${it.t}</p><div class="seg">${
      SCALE.map((s, i) => `<label><input type="radio" name="${prefix}-${it.k}" value="${i + 1}"><span>${s}</span></label>`).join("")
    }</div></div>`).join("");
  }
  ["pre", "post"].forEach(p => {
    const f = $(p + "Form");
    f.querySelectorAll(".mood").forEach(m => buildMood(m, p));
    buildItems(f.querySelector("[data-items]"), p);
  });
  function readForm(p) {
    const f = $(p + "Form"), val = n => { const x = f.querySelector(`input[name="${p}-${n}"]:checked`); return x ? +x.value : null; };
    const items = {}; ITEMS.forEach(it => items[it.k] = val(it.k));
    return { mood: val("mood"), items, rec: val("rec") };
  }
  function missing(r) { return r.mood == null || Object.values(r.items).some(v => v == null); }

  $("preForm").addEventListener("submit", async e => {
    e.preventDefault();
    const r = readForm("pre"), err = $("preForm").querySelector("[data-err]");
    if (missing(r)) { err.textContent = "Please answer every question. There are no right answers."; err.hidden = false; return; }
    err.hidden = true;
    sess.pre = { mood: r.mood, items: r.items, at: Date.now() };
    await save(); window.scrollTo(0, 0); renderPlay();
  });
  $("careGo").addEventListener("click", () => { careShown = true; renderPlay(); });

  $("postForm").addEventListener("submit", async e => {
    e.preventDefault();
    const r = readForm("post"), err = $("postForm").querySelector("[data-err]");
    if (missing(r)) { err.textContent = "Please answer the check-in and the four statements."; err.hidden = false; return; }
    err.hidden = true;
    sess.post = { mood: r.mood, items: r.items, rec: r.rec, choose: $("chooseNext").value.trim().slice(0, 600), at: Date.now() };
    await save(); window.scrollTo(0, 0); go("done");
  });
  $("backToGame").addEventListener("click", () => go("game"));

  /* ---------- game hooks ---------- */
  Game.init();
  Game.onRunEnd = run => { if (!sess) return; sess.runs.push(run); if (sess.runs.length > 50) sess.runs.shift(); save(); };
  Game.onFinish = () => { window.scrollTo(0, 0); go(sess && sess.post ? "done" : "post"); };

  /* ---------- results ---------- */
  function avg(o) { const v = Object.values(o || {}).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
  function fillDone() {
    const runs = sess.runs || [];
    const best = runs.reduce((m, r) => Math.max(m, r.xp), 0);
    const bestLvl = runs.reduce((m, r) => Math.min(m, r.level), 5);
    const ch = runs.flatMap(r => r.choices || []); const owned = ch.filter(c => c.good).length;
    const a = avg(sess.pre.items), b = avg(sess.post.items);
    $("doneMsg").textContent = `You played ${runs.length} ${runs.length === 1 ? "run" : "runs"} and reached Level ${bestLvl}, ${LEVELS.find(l => l.n === bestLvl).name}.`;
    const cells = [
      [`${sess.pre.mood} → ${sess.post.mood}`, "How you are, out of 10"],
      [a != null && b != null ? `${a.toFixed(1)} → ${b.toFixed(1)}` : "–", "Your four statements, average of 5"],
      [best.toLocaleString(), "Best XP"],
      [ch.length ? Math.round(100 * owned / ch.length) + "%" : "–", "Triggers where you owned your part"],
    ];
    $("compare").innerHTML = cells.map(([v, l]) => `<div><b class="num">${v}</b><span>${l}</span></div>`).join("");
    const base = location.origin && location.origin !== "null" ? location.origin + location.pathname : "";
    const link = (base || "") + "?ref=" + sess.shareCode + "#play";
    $("shareLink").textContent = link; $("shareCode").textContent = sess.shareCode;
  }
  $("copyShare").addEventListener("click", () => {
    const t = $("shareLink").textContent, msg = $("copyMsg");
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($("shareLink")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); msg.textContent = "Selected. Copy it to share."; };
    try { navigator.clipboard.writeText(t).then(() => { msg.textContent = "Link copied."; }, fallback); } catch (e) { fallback(); }
  });
  $("playMore").addEventListener("click", () => go("game"));
  let confirmNew = false;
  $("newSession").addEventListener("click", e => {
    if (!confirmNew) { confirmNew = true; e.target.textContent = "Tap again to start over. Your results here will be cleared from this device."; return; }
    lsSet(SKEY, null); sess = null; careShown = false; confirmNew = false;
    e.target.textContent = "Start over as someone new (shared device)";
    ["pre", "post"].forEach(p => $(p + "Form").reset()); $("introForm").reset(); $("refInput").value = lsGet(RKEY) || "";
    go("intro");
  });

  /* ---------- prototype gallery screens: #demo-<screen>, sample answers, nothing saved ---------- */
  function showPage(page) {
    document.querySelectorAll("main > [data-page]").forEach(s => s.hidden = s.dataset.page !== page);
    document.querySelectorAll(".nav a").forEach(a => { if (a.dataset.page === page) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  }
  function check(form, name, val) { const x = $(form).querySelector(`input[name="${name}"][value="${val}"]`); if (x) x.checked = true; }
  function sampleSession() {
    return { id: "demosample01", v: 1, createdAt: Date.now() - 9e5, ref: "UM-NOV", shareCode: "F7KQ2M", age: "21–24", consent: true, device: "touch",
      pre: { mood: 5, items: { notice: 3, pause: 2, own: 3, help: 2 }, at: Date.now() - 86e4 },
      runs: [{ xp: 1480, level: 3, durationS: 96, aboveRatio: .67, choices: [{ s: "s06", good: true }, { s: "s04", good: false }, { s: "s10", good: true }, { s: "s15", good: true }, { s: "s18", good: true }] },
             { xp: 2240, level: 3, durationS: 131, aboveRatio: .74, choices: [{ s: "s02", good: true }, { s: "s07", good: false }, { s: "s12", good: true }, { s: "s03", good: true }] }],
      post: { mood: 7, items: { notice: 4, pause: 3, own: 4, help: 3 }, rec: 8, choose: "Text my friend first instead of waiting.", at: Date.now() } };
  }
  function demo(screen) {
    window.EHP_DEMO = true;
    const play = ["intro", "pre", "care", "howto", "track", "trigger", "levelup", "flow", "summary", "post", "done"];
    if (!play.includes(screen)) {
      showPage(["how", "support"].includes(screen) ? screen : "home");
      Game.hide(); setSheet(screen === "talk"); return;
    }
    showPage("play"); setSheet(false);
    sess = sampleSession();
    const step = ["howto", "track", "trigger", "levelup", "flow", "summary"].includes(screen) ? "game" : screen;
    ["intro", "pre", "care", "game", "post", "done"].forEach(s => $("st-" + s).hidden = s !== step);
    const stepKey = step === "care" ? "pre" : step;
    document.querySelectorAll("#steps span").forEach(s => s.classList.toggle("on", s.dataset.s === stepKey));
    if (screen === "intro") {
      $("refInput").value = "UM-NOV"; $("refMsg").className = "ok-s"; $("refMsg").textContent = "Code recognised: Universiti Malaya workshop.";
      ageSel.value = "21–24"; $("consent").checked = true;
    }
    if (screen === "pre") { check("preForm", "pre-mood", 5); Object.entries(sess.pre.items).forEach(([k, v]) => check("preForm", "pre-" + k, v)); }
    if (screen === "post") {
      check("postForm", "post-mood", 7); Object.entries(sess.post.items).forEach(([k, v]) => check("postForm", "post-" + k, v));
      check("postForm", "post-rec", 8); $("chooseNext").value = sess.post.choose;
    }
    if (screen === "done") fillDone();
    if (step === "game") {
      Game.finishLabel = "Finish and reflect";
      requestAnimationFrame(() => { Game.demo(screen); const el = $("st-game"), y = el.getBoundingClientRect().top + scrollY; window.scrollTo(0, innerWidth > 640 ? Math.max(0, y - (innerHeight - el.offsetHeight) / 2) : y - 80); });
    }
  }

  if (!(location.hash || "").startsWith("#demo-")) Store.detect();
  route();
})();
