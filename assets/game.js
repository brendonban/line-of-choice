/* Line of Choice — the runner. Reads its DOM by id; reports each run through Game.onRunEnd(run). */
window.Game = (() => {
  "use strict";
  const { LEVELS, SCENARIOS: SCEN } = window.EHP;
  const CLUTTER = ["ping!", "17 unread", "to-do", "doomscroll", "@everyone", "deadline", "what if…", "seen 2h ago", "notif", "group chat"];
  const ABOVE_WORDS = ["notice", "own it", "ask for help", "choose again"];
  const BELOW_WORDS = ["blame", "defend", "deny", "justify"];
  // Game art keeps the original booklet look: sunny yellow, cut-paper flowers, hand lettering, red line of choice.
  const INK = "#4A4A50", GOOD = "#0E9647", BAD = "#E8382F", BLUE = "#1176BD", ORANGE = "#F7941D";
  const HAND = '"Gaegu", "Comic Sans MS", "Chalkboard SE", cursive';

  const $ = id => document.getElementById(id);
  let cv, ctx, stage, els;
  const H = 400, Y_LINE = 205, Y_BOT = 368;
  let W = 800, scale = 1, dpr = 1;
  let running = false, paused = false, active = false, S = null, choiceState = null, last = 0, toastTimer = 0;
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const api = { onRunEnd: null, onFinish: null, finishLabel: "Finish and reflect" };

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function fresh() {
    return {
      t: 0, real: 0, dist: 0, speed: 300, xp: 0, lvl: 0, presence: 100, lane: 0, y: Y_LINE,
      hitFlash: 0, obstacles: [], orbs: [], floaters: [], held: { head: false, heart: false, body: false },
      flow: 0, observe: 0, obsCd: 0, slowmo: 1, nextClutter: 1.3, nextOrb: 2.4, nextChoice: 5.5,
      deck: shuffle(SCEN.slice()), streak: 0, bestStreak: 0, choices: [], aboveT: 0, hits: 0, orbsGot: 0, flows: 0, observes: 0, startedAt: Date.now(),
    };
  }

  /* audio */
  let ac = null;
  function beep(f, d = .08, type = "sine", v = .04) {
    if (!ac) return;
    try { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.value = v; o.connect(g); g.connect(ac.destination); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d); o.start(); o.stop(ac.currentTime + d); } catch (e) {}
  }

  function resize() {
    if (!stage || !stage.clientWidth) return;
    const cw = stage.clientWidth, ch = Math.max(260, Math.min(400, cw * 0.55));
    scale = ch / H; W = cw / scale; dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.height = ch + "px"; cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    draw();
  }

  /* controls */
  function goUp() { if (running && !paused) { if (S.lane) beep(660, .05, "triangle"); S.lane = 0; } }
  function goDown() { if (running && !paused) { if (!S.lane) beep(330, .05, "triangle"); S.lane = 1; } }
  function observe() {
    if (!running || paused || S.obsCd > 0) return;
    S.observe = 3; S.obsCd = 12; S.observes++; beep(880, .25, "sine", .03);
    float("Inner observer on", W * .5, 120, BLUE);
  }
  function onKey(e) {
    if (!active) return;
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (!els.choice.hidden) { if (e.key === "1") { pick(0); e.preventDefault(); } else if (e.key === "2") { pick(1); e.preventDefault(); } return; }
    if (!running) return;
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { goUp(); e.preventDefault(); }
    else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { goDown(); e.preventDefault(); }
    else if (e.key === "o" || e.key === "O" || e.key === " ") { observe(); e.preventDefault(); }
  }

  function init() {
    stage = $("g-stage"); cv = $("g-cv"); ctx = cv.getContext("2d");
    els = {
      lvl: $("g-lvl"), xpT: $("g-xpt"), xpF: $("g-xpf"), prT: $("g-prt"), prF: $("g-prf"), streak: $("g-streak"), cen: $("g-centres"), flow: $("g-flow"),
      start: $("g-start"), choice: $("g-choice"), over: $("g-over"), scen: $("g-scen"), timer: $("g-timer"), opt: [$("g-opt0"), $("g-opt1")],
      toast: $("g-toast"), obs: $("g-obs"),
    };
    document.addEventListener("keydown", onKey);
    let y0 = null;
    cv.addEventListener("pointerdown", e => { y0 = e.clientY; const r = cv.getBoundingClientRect(); ((e.clientY - r.top) / scale < (Y_LINE + 20)) ? goUp() : goDown(); });
    cv.addEventListener("pointermove", e => { if (y0 == null) return; const dy = e.clientY - y0; if (dy < -24) { goUp(); y0 = null; } else if (dy > 24) { goDown(); y0 = null; } });
    window.addEventListener("pointerup", () => y0 = null);
    $("g-up").addEventListener("click", goUp);
    $("g-down").addEventListener("click", goDown);
    els.obs.addEventListener("click", observe);
    $("g-go").addEventListener("click", start);
    $("g-again").addEventListener("click", start);
    $("g-finish").addEventListener("click", () => api.onFinish && api.onFinish());
    els.opt.forEach((b, i) => b.addEventListener("click", () => pick(i)));
    window.addEventListener("resize", resize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw());
  }

  function getBest() { try { return +localStorage.getItem("loc_best") || 0; } catch (e) { return 0; } }
  function showBest() { const b = getBest(); const el = $("g-best"); if (el) el.textContent = b ? `Best: ${b.toLocaleString()} XP` : ""; }
  function show() {
    active = true; showBest();
    els.start.hidden = false; els.over.hidden = true; els.choice.hidden = true;
    requestAnimationFrame(resize);
  }
  function hide() { active = false; running = false; paused = false; choiceState = null; }

  function start() {
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume && ac.resume(); } catch (e) { ac = null; }
    S = fresh(); running = true; paused = false;
    els.start.hidden = true; els.over.hidden = true; els.choice.hidden = true;
    hud(); last = performance.now(); requestAnimationFrame(loop);
    stage.focus({ preventScroll: true });
  }

  function openChoice() {
    if (!S.deck.length) S.deck = shuffle(SCEN.slice());
    const sc = S.deck.pop();
    const order = Math.random() < .5 ? [0, 1] : [1, 0];
    const limit = Math.max(3.4, 6 - S.lvl * 0.6);
    choiceState = { sc, order, limit, left: limit };
    els.scen.textContent = sc.t;
    order.forEach((k, i) => { els.opt[i].querySelector("span").textContent = k === 0 ? sc.good : sc.bad; });
    els.choice.hidden = false; paused = true;
    els.opt[0].focus({ preventScroll: true });
    beep(220, .16, "square", .02);
  }
  function pick(i) { if (choiceState) resolveChoice(choiceState.order[i] === 0, false); }
  function resolveChoice(good, timedOut) {
    const { sc, limit, left } = choiceState; choiceState = null;
    els.choice.hidden = true; paused = false;
    S.choices.push({ s: sc.id, good, timedOut, ms: Math.round((limit - Math.max(0, left)) * 1000) });
    if (good) {
      S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
      const gain = Math.round((100 + 25 * Math.min(S.streak - 1, 8)) * (S.flow > 0 ? 2 : 1));
      addXp(gain); S.presence = Math.min(100, S.presence + 8); S.lane = 0;
      float(`+${gain} XP · owned it`, W * .5, 150, GOOD);
      beep(523, .08); setTimeout(() => beep(784, .12), 80);
    } else {
      S.streak = 0; S.presence -= 22; S.lane = 1; S.hitFlash = .5;
      float(timedOut ? "Automatic response took over" : `Below the line: ${sc.tag}`, W * .5, 150, BAD);
      beep(160, .25, "sawtooth", .03);
    }
    S.nextChoice = 8 + Math.random() * 4;
    const px = W * .18;
    S.obstacles = S.obstacles.filter(o => o.x > px + 260 || o.x < px - 40);
    hud(); stage.focus({ preventScroll: true });
  }

  function addXp(n) {
    S.xp += n;
    while (S.lvl < LEVELS.length - 1 && S.xp >= LEVELS[S.lvl + 1].xp) {
      S.lvl++; const L = LEVELS[S.lvl];
      toast(`Level ${L.n} · ${L.name}`, L.desc);
      beep(523, .1); setTimeout(() => beep(659, .1), 100); setTimeout(() => beep(1046, .2), 200);
    }
  }
  function toast(title, body) {
    els.toast.innerHTML = ""; const s = document.createElement("strong"); s.textContent = title;
    els.toast.append(s, document.createTextNode(body)); els.toast.style.opacity = 1;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => els.toast.style.opacity = 0, 3600);
  }
  function float(txt, x, y, col) { S.floaters.push({ txt, x, y, col, life: 1.4 }); }

  let demoMode = false;
  function gameOver() {
    running = false; paused = false; els.choice.hidden = true; choiceState = null;
    const L = LEVELS[S.lvl];
    const run = {
      at: S.startedAt, xp: Math.round(S.xp), level: L.n, durationS: Math.round(S.real),
      aboveRatio: +(S.aboveT / Math.max(1, S.real)).toFixed(3), hits: S.hits, orbs: S.orbsGot, flows: S.flows,
      observes: S.observes, bestStreak: S.bestStreak, choices: S.choices,
    };
    const good = S.choices.filter(c => c.good).length;
    $("g-over-title").textContent = L.n === 1 ? "You reached Presence" : "Presence ran out";
    $("g-over-msg").textContent = `You got to Level ${L.n}, ${L.name}. Time below the line is normal. The aim is to notice sooner and choose again.`;
    $("g-s-xp").textContent = run.xp.toLocaleString();
    $("g-s-lvl").textContent = L.n;
    $("g-s-above").textContent = Math.round(run.aboveRatio * 100) + "%";
    $("g-s-ch").textContent = `${good}/${S.choices.length}`;
    const ul = $("g-review"); ul.innerHTML = "";
    S.choices.slice(-4).reverse().forEach(c => {
      const sc = SCEN.find(x => x.id === c.s); const li = document.createElement("li");
      const mk = document.createElement("span"); mk.className = "mk" + (c.good ? " up" : "");
      const t = document.createElement("span");
      t.textContent = c.good ? `${sc.t} You chose: ${sc.good}.` : `${sc.t} ${c.timedOut ? "Autopilot chose" : "You chose"}: ${sc.bad}. Above the line: ${sc.good}.`;
      li.append(mk, t); ul.append(li);
    });
    $("g-finish").textContent = api.finishLabel;
    els.over.hidden = false;
    $("g-finish").focus({ preventScroll: true });
    if (!demoMode) { try { if (run.xp > getBest()) localStorage.setItem("loc_best", String(run.xp)); } catch (e) {} }
    if (api.onRunEnd && !demoMode) api.onRunEnd(run);
  }

  /* frozen sample frames for the prototype gallery (no data is reported) */
  function demo(kind) {
    demoMode = true; active = true; running = false; resize();
    S = fresh();
    Object.assign(S, { t: 14, real: 52, dist: 2600, speed: 380, xp: 620, lvl: 1, presence: 72, streak: 3, bestStreak: 3, aboveT: 38, y: Y_LINE,
      held: { head: true, heart: true, body: false } });
    S.obstacles = [{ x: W * .44, lane: 0, w: 104, h: 46, txt: "17 unread", rot: -.05 }, { x: W * .74, lane: 1, w: 116, h: 46, txt: "doomscroll", rot: .06 }];
    S.orbs = [{ x: W * .6, lane: 0, kind: "body", bob: 1 }];
    S.floaters = [{ txt: "+150 XP · owned it", x: W * .5, y: 110, col: GOOD, life: 1 }];
    S.choices = [
      { s: "s06", good: true, timedOut: false, ms: 1800 }, { s: "s04", good: false, timedOut: true, ms: 5000 },
      { s: "s10", good: true, timedOut: false, ms: 2300 }, { s: "s15", good: true, timedOut: false, ms: 1500 }];
    els.start.hidden = kind !== "howto"; els.over.hidden = true; els.choice.hidden = true;
    if (kind === "howto") { S = null; draw(); return; }
    if (kind === "trigger") {
      const sc = SCEN.find(x => x.id === "s04"); els.scen.textContent = sc.t;
      els.opt[0].querySelector("span").textContent = sc.bad; els.opt[1].querySelector("span").textContent = sc.good;
      els.timer.style.width = "58%"; els.choice.hidden = false; S.floaters = [];
    }
    if (kind === "levelup") { S.floaters = []; const L = LEVELS[1]; toast(`Level ${L.n} · ${L.name}`, L.desc); clearTimeout(toastTimer); }
    if (kind === "flow") { S.flow = 4.2; S.held = { head: false, heart: false, body: false }; S.orbs = []; S.floaters = [{ txt: "PRESENCE FLOW · 2× XP", x: W * .5, y: 110, col: ORANGE, life: 1 }]; }
    hud(); draw();
    if (kind === "summary") { S.presence = 0; S.xp = 1480; S.lvl = 2; S.real = 96; S.aboveT = 64; hud(); gameOver(); }
  }

  function loop(now) {
    if (!running || !active) return;
    const rdt = Math.min(.05, (now - last) / 1000); last = now;
    update(rdt); draw(); hud();
    requestAnimationFrame(loop);
  }

  function update(rdt) {
    if (paused && choiceState) {
      choiceState.left -= rdt;
      els.timer.style.width = Math.max(0, 100 * choiceState.left / choiceState.limit) + "%";
      if (choiceState.left <= 0) resolveChoice(false, true);
      return;
    }
    S.observe = Math.max(0, S.observe - rdt); S.obsCd = Math.max(0, S.obsCd - rdt);
    S.slowmo += ((S.observe > 0 ? .5 : 1) - S.slowmo) * Math.min(1, rdt * 8);
    const dt = rdt * S.slowmo;
    S.t += dt; S.real += rdt;
    S.speed = Math.min(640, 300 + S.t * 5.5); S.dist += S.speed * dt;
    S.flow = Math.max(0, S.flow - rdt); S.hitFlash = Math.max(0, S.hitFlash - rdt);

    const ty = S.lane === 0 ? Y_LINE : Y_BOT;
    S.y += (ty - S.y) * Math.min(1, rdt * 16);
    const above = S.y < (Y_LINE + Y_BOT) / 2;
    if (above) S.aboveT += rdt;
    const mult = S.flow > 0 ? 2 : 1;
    addXp((above ? 10 : 2) * mult * dt * (1 + S.lvl * .15));
    S.presence = Math.min(100, S.presence + (above ? 1.2 : -3.2) * dt);

    S.nextClutter -= dt; S.nextOrb -= dt; S.nextChoice -= dt;
    const px = W * .18;
    if (S.nextClutter <= 0) {
      const lane = Math.random() < .62 ? 0 : 1;
      const lastO = S.obstacles[S.obstacles.length - 1];
      if (!(lastO && lastO.x > W - 60 && lastO.lane !== lane)) {
        const txt = CLUTTER[Math.floor(Math.random() * CLUTTER.length)];
        ctx.font = `700 20px ${HAND}`;
        S.obstacles.push({ x: W + 20, lane, w: Math.max(64, ctx.measureText(txt).width + 26), h: 46, txt, rot: (Math.random() - .5) * .16, hit: false });
      }
      S.nextClutter = Math.max(.55, 1.6 - S.t * .012) + Math.random() * .7;
    }
    if (S.nextOrb <= 0) {
      const need = ["head", "heart", "body"].filter(k => !S.held[k]);
      const pool = need.length ? need : ["head", "heart", "body"];
      const lane = Math.random() < .7 ? 0 : 1;
      if (!S.obstacles.some(o => o.lane === lane && o.x > W - 120)) S.orbs.push({ x: W + 30, lane, kind: pool[Math.floor(Math.random() * pool.length)], bob: Math.random() * 6 });
      S.nextOrb = 2 + Math.random() * 1.8;
    }
    if (S.nextChoice <= 0) { openChoice(); return; }

    const pTop = S.y - 74, pBot = S.y - 2;
    S.obstacles.forEach(o => {
      o.x -= S.speed * dt;
      const floor = o.lane === 0 ? Y_LINE : Y_BOT;
      if (!o.hit && o.x < px + 16 && o.x + o.w > px - 16 && pBot > floor - o.h && pTop < floor) {
        o.hit = true;
        if (S.flow > 0) float("Clutter bounces off", px + 40, floor - 90, BLUE);
        else { S.presence -= 16; S.hitFlash = .4; S.hits++; float("−16 presence", px + 40, floor - 90, BAD); beep(120, .15, "square", .03); }
      }
    });
    S.obstacles = S.obstacles.filter(o => o.x + o.w > -20);
    S.orbs.forEach(o => {
      o.x -= S.speed * dt; o.bob += dt * 4;
      const oy = (o.lane === 0 ? Y_LINE : Y_BOT) - 62;
      if (!o.got && Math.abs(o.x - px) < 28 && oy > pTop - 14 && oy < pBot + 14) {
        o.got = true; S.held[o.kind] = true; S.orbsGot++; S.presence = Math.min(100, S.presence + 5);
        addXp(15 * mult); beep(988, .06);
        if (S.held.head && S.held.heart && S.held.body) {
          S.flow = 6; S.flows++; S.held = { head: false, heart: false, body: false };
          float("PRESENCE FLOW · 2× XP", W * .5, 110, ORANGE);
          beep(659, .1); setTimeout(() => beep(880, .1), 90); setTimeout(() => beep(1175, .2), 180);
        }
      }
    });
    S.orbs = S.orbs.filter(o => o.x > -30 && !o.got);
    S.floaters.forEach(f => { f.life -= rdt; f.y -= 28 * rdt; });
    S.floaters = S.floaters.filter(f => f.life > 0);
    if (bg) bg.forEach(o => { o.x -= S.speed * dt * .12; if (o.x < -80) { o.x = W + 80 + Math.random() * 300; o.y = 40 + Math.random() * 120; } });
    if (S.presence <= 0) { S.presence = 0; hud(); gameOver(); }
  }

  function hud() {
    if (!S) return;
    const L = LEVELS[S.lvl], N = LEVELS[S.lvl + 1];
    els.lvl.textContent = `Level ${L.n} · ${L.name}`;
    els.xpT.textContent = N ? `${Math.floor(S.xp).toLocaleString()} / ${N.xp.toLocaleString()} XP` : `${Math.floor(S.xp).toLocaleString()} XP`;
    els.xpF.style.width = (N ? 100 * (S.xp - L.xp) / (N.xp - L.xp) : 100) + "%";
    els.prT.textContent = Math.ceil(S.presence);
    els.prF.style.width = Math.max(0, S.presence) + "%";
    els.streak.textContent = `×${S.streak} streak`;
    els.streak.classList.toggle("on", S.streak >= 3);
    [...els.cen.children].forEach((d, i) => d.classList.toggle("on", S.held[["head", "heart", "body"][i]]));
    els.flow.textContent = S.flow > 0 ? `flow ${Math.ceil(S.flow)}s` : "";
    els.flow.parentElement.classList.toggle("on", S.flow > 0);
    els.obs.disabled = S.obsCd > 0;
    els.obs.textContent = S.obsCd > 0 ? `Observe ${Math.ceil(S.obsCd)}s` : "Observe";
  }

  /* drawing: the original booklet-style track */
  let bg = null;
  function makeBg() {
    const cols = ["#F7941D", "#E8382F", "#0E9647", "#1176BD", "#CDE3B4"]; const arr = [];
    for (let i = 0; i < 9; i++) arr.push({ x: Math.random() * 1600, y: 40 + Math.random() * 120, r: 22 + Math.random() * 38, c: cols[i % cols.length], rot: Math.random() * 6, k: Math.random() < .5 ? 0 : 1 });
    return arr;
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function blob(b) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = b.c; ctx.globalAlpha = .9;
    if (b.k === 0) { for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.ellipse(b.r * .5, 0, b.r * .55, b.r * .35, 0, 0, Math.PI * 2); ctx.fill(); } }
    else { ctx.beginPath(); ctx.ellipse(0, 0, b.r, b.r * .45, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function draw() {
    if (!ctx) return;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    bg = bg || makeBg();
    const st = S || { dist: 0, t: 0, y: Y_LINE, obstacles: [], orbs: [], floaters: [], flow: 0, observe: 0, hitFlash: 0 };
    ctx.fillStyle = "#FFFDE0"; ctx.fillRect(0, 0, W, Y_LINE + 6);
    ctx.fillStyle = "#FFF97A"; ctx.beginPath(); ctx.arc(W * .78, 70, 120, 0, Math.PI * 2); ctx.fill();
    bg.forEach(blob);
    ctx.fillStyle = "#CDE3B4"; ctx.beginPath(); ctx.moveTo(0, Y_LINE);
    for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, Y_LINE - 18 - 10 * Math.sin((x + st.dist * .3) / 90));
    ctx.lineTo(W, Y_LINE); ctx.closePath(); ctx.fill();

    ctx.fillStyle = "#E9E9EC"; ctx.fillRect(0, Y_LINE, W, H - Y_LINE);
    ctx.save(); ctx.font = `700 44px ${HAND}`; ctx.fillStyle = "rgba(74,74,80,.09)"; ctx.textBaseline = "middle";
    const span = 220, off = (st.dist * .5) % (span * 4);
    for (let i = 0; i < Math.ceil(W / span) + 5; i++) ctx.fillText(BELOW_WORDS[i % 4].toUpperCase(), i * span - off, Y_LINE + 70 + (i % 2) * 34);
    ctx.restore();
    ctx.fillStyle = "#D6D6DA"; ctx.fillRect(0, Y_BOT, W, H - Y_BOT);
    ctx.fillStyle = "#C3C3C9"; const doff = st.dist % 60;
    for (let x = -doff; x < W; x += 60) ctx.fillRect(x, Y_BOT + 12, 26, 4);

    ctx.fillStyle = "#B3241D"; rr(-10, Y_LINE + 1, W + 20, 12, 6); ctx.fill();
    ctx.fillStyle = "#E8382F"; rr(-10, Y_LINE - 3, W + 20, 12, 6); ctx.fill();
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 20px ${HAND}`; ctx.fillStyle = "#E8382F"; ctx.textAlign = "right";
    ctx.fillText("LINE OF CHOICE", W - 14, Y_LINE + 32); ctx.textAlign = "left";
    ctx.font = `700 16px ${HAND}`; ctx.fillStyle = "rgba(74,74,80,.55)";
    ctx.fillText("personal responsibility", 14, 24);
    ctx.fillText("blame · defend · deny · justify", 14, Y_LINE + 30);

    const orbCol = { head: "#96D6F0", heart: "#9EC6B0", body: "#F59AA0" };
    st.orbs.forEach(o => {
      const y = (o.lane === 0 ? Y_LINE : Y_BOT) - 60 + (reduceMotion ? 0 : Math.sin(o.bob) * 5);
      ctx.fillStyle = orbCol[o.kind]; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(o.x, y, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = `700 14px ${HAND}`; ctx.textAlign = "center"; ctx.fillText(o.kind, o.x, y + 32); ctx.textAlign = "left";
    });

    st.obstacles.forEach(o => {
      const floor = o.lane === 0 ? Y_LINE : Y_BOT;
      ctx.save(); ctx.translate(o.x + o.w / 2, floor - o.h / 2); ctx.rotate(o.rot || 0);
      ctx.globalAlpha = o.hit ? .35 : 1;
      ctx.fillStyle = "rgba(74,74,80,.18)"; rr(-o.w / 2 + 3, -o.h / 2 + 4, o.w, o.h, 8); ctx.fill();
      ctx.fillStyle = "#FFFFFF"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; rr(-o.w / 2, -o.h / 2, o.w, o.h, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#E8382F"; ctx.beginPath(); ctx.arc(o.w / 2 - 4, -o.h / 2 + 4, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = INK; ctx.font = `700 20px ${HAND}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(o.txt, 0, 2); ctx.restore();
    });

    drawPlayer(st);

    st.floaters.forEach(f => {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life)); ctx.font = `700 24px ${HAND}`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.lineWidth = 5; ctx.strokeStyle = "#FFFFFF"; ctx.strokeText(f.txt, f.x, f.y); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y);
      ctx.globalAlpha = 1; ctx.textAlign = "left";
    });
    if (st.observe > 0) { ctx.fillStyle = "rgba(17,118,189,.08)"; ctx.fillRect(0, 0, W, H); }
    if (st.hitFlash > 0) { ctx.fillStyle = `rgba(232,56,47,${st.hitFlash * .35})`; ctx.fillRect(0, 0, W, H); }
  }
  function drawPlayer(st) {
    const x = W * .18, fy = st.y, above = fy < (Y_LINE + Y_BOT) / 2, ph = reduceMotion ? 0 : (st.t || 0) * 14;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (st.flow > 0) {
      ctx.fillStyle = "rgba(255,242,0,.55)"; ctx.beginPath(); ctx.ellipse(x, fy - 2, 46, 10, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + (st.t || 0) * 2; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 30, fy - 40 + Math.sin(a) * 44); ctx.lineTo(x + Math.cos(a) * 38, fy - 40 + Math.sin(a) * 54); ctx.stroke(); }
    }
    ctx.fillStyle = "rgba(74,74,80,.18)"; ctx.beginPath(); ctx.ellipse(x, fy, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
    const l1 = Math.sin(ph) * 10, l2 = -l1;
    ctx.strokeStyle = "#8FD0D6"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x - 3, fy - 26); ctx.lineTo(x - 3 + l1, fy - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 3, fy - 26); ctx.lineTo(x + 3 + l2, fy - 4); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 3 + l1, fy - 3); ctx.lineTo(x + 4 + l1, fy - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 3 + l2, fy - 3); ctx.lineTo(x + 10 + l2, fy - 3); ctx.stroke();
    ctx.fillStyle = above ? "#FFF6B8" : "#B9B9BF"; ctx.lineWidth = 2.5;
    rr(x - 11, fy - 50, 22, 26, 5); ctx.fill(); ctx.stroke();
    const a1 = Math.sin(ph + Math.PI) * 9;
    ctx.beginPath(); ctx.moveTo(x - 10, fy - 46); ctx.lineTo(x - 18 + a1, fy - 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10, fy - 46); ctx.lineTo(x + 18 - a1, fy - 30); ctx.stroke();
    ctx.fillStyle = "#FFFFFF"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x + 1, fy - 66, 14, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + 5, fy - 68, 1.6, 0, Math.PI * 2); ctx.arc(x + 10, fy - 68, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2; ctx.beginPath();
    if (above) ctx.arc(x + 7, fy - 63, 4, .2, Math.PI - .2); else { ctx.moveTo(x + 3, fy - 73); ctx.lineTo(x + 7, fy - 71); ctx.moveTo(x + 4, fy - 59); ctx.lineTo(x + 11, fy - 60); }
    ctx.stroke(); ctx.restore();
  }

  return Object.assign(api, { init, show, hide, start, resize, demo });
})();
