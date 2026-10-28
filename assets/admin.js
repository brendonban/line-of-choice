(() => {
  "use strict";
  const { SCENARIOS, LEVELS, ITEMS, AGES } = window.EHP;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DEMO = location.hash === "#demo";
  const PKEY = "ehp_admin_pw";
  let pw = ""; try { pw = sessionStorage.getItem(PKEY) || ""; } catch (e) {}
  let DATA = { sessions: [], refs: [] }, openId = null, timer = 0, shown = 50;

  /* ---------- helpers ---------- */
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const f1 = v => v == null ? "–" : v.toFixed(1);
  const pct = v => v == null ? "–" : Math.round(v * 100) + "%";
  const fmtDate = t => new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const bestLevel = s => (s.runs || []).reduce((m, r) => Math.min(m, r.level), 6);
  const bestXp = s => (s.runs || []).reduce((m, r) => Math.max(m, r.xp), 0);
  const choicesOf = s => (s.runs || []).flatMap(r => r.choices || []);
  const itemAvg = it => it ? mean(Object.values(it).filter(v => v != null)) : null;

  function banner(html) { $("banner").hidden = !html; $("bannerTxt").innerHTML = html || ""; }

  /* ---------- load ---------- */
  async function load() {
    if (DEMO) {
      DATA = { sessions: EHP_SAMPLE.sessions, refs: EHP_SAMPLE.refs };
      banner("<b>Sample data.</b> These sessions are invented to show how the console looks. Nothing here is real or saved.");
      return showDash();
    }
    const mode = await Store.detect();
    if (mode === "local") {
      const h = Store.health || {};
      banner(h.ok
        ? "<b>No database connected yet.</b> The site is live but sessions are only kept in each player’s own browser. In Vercel, add an Upstash Redis store (Storage tab) and set <code>ADMIN_PASSWORD</code>, then redeploy."
        : "<b>Local demo mode.</b> Showing sessions saved in this browser only. Deploy to Vercel with a database to collect sessions from every player. <a href=\"#demo\" onclick=\"location.hash='#demo';location.reload()\">See sample data</a>.");
      DATA = await Store.adminLoad("");
      return showDash();
    }
    if (!pw) return showLogin();
    try { DATA = await Store.adminLoad(pw); banner(""); showDash(); }
    catch (e) { if (e.status === 401) { pw = ""; try { sessionStorage.removeItem(PKEY); } catch (x) {} showLogin("That password didn’t work. Try again."); } else showLogin(e.message); }
  }
  function showLogin(err) {
    $("login").hidden = false; $("dash").hidden = true; $("topBtns").hidden = true;
    $("loginErr").hidden = !err; $("loginErr").textContent = err || ""; $("pw").focus();
  }
  $("loginForm").addEventListener("submit", e => {
    e.preventDefault(); pw = $("pw").value; try { sessionStorage.setItem(PKEY, pw); } catch (x) {} load();
  });
  $("logout").addEventListener("click", () => { pw = ""; try { sessionStorage.removeItem(PKEY); } catch (x) {} if (DEMO) { location.hash = ""; location.reload(); } else showLogin(); });
  $("refresh").addEventListener("click", load);

  function showDash() {
    $("login").hidden = true; $("dash").hidden = false; $("topBtns").hidden = false;
    $("logout").textContent = DEMO ? "Leave sample" : (Store.mode === "api" ? "Sign out" : "Sample data");
    if (!DEMO && Store.mode !== "api") $("logout").onclick = () => { location.hash = "#demo"; location.reload(); };
    fillFilters(); render();
    clearInterval(timer); if (Store.mode === "api" && !DEMO) timer = setInterval(load, 45000);
    $("foot").textContent = "Updated " + new Date().toLocaleTimeString();
  }

  /* ---------- filters ---------- */
  function fillFilters() {
    const codes = new Set(DATA.refs.map(r => r.code)); DATA.sessions.forEach(s => s.ref && codes.add(s.ref));
    const keep = $("fRef").value;
    $("fRef").innerHTML = `<option value="">All codes</option><option value="__none">No code</option><option value="__friend">Friend invites</option>` + [...codes].filter(c => isAdminCode(c) || !isFriend(c)).sort().map(c => `<option>${esc(c)}</option>`).join("");
    $("fRef").value = keep;
    if (!$("fAge").options.length) $("fAge").innerHTML = `<option value="">All ages</option>` + AGES.map(a => `<option>${esc(a)}</option>`).join("");
  }
  const isAdminCode = c => DATA.refs.some(r => r.code === c);
  const isFriend = c => DATA.sessions.some(s => s.shareCode === c);
  ["fRef", "fRange", "fAge"].forEach(id => $(id).addEventListener("change", render));
  function filtered() {
    const ref = $("fRef").value, days = +$("fRange").value, age = $("fAge").value, cut = days ? Date.now() - days * 864e5 : 0;
    return DATA.sessions.filter(s =>
      (!cut || s.createdAt >= cut) && (!age || s.age === age) &&
      (!ref || (ref === "__none" ? !s.ref : ref === "__friend" ? (s.ref && isFriend(s.ref) && !isAdminCode(s.ref)) : s.ref === ref))
    ).sort((a, b) => b.createdAt - a.createdAt);
  }

  /* ---------- render ---------- */
  function render() {
    const S = filtered();
    $("fCount").textContent = `${S.length} of ${DATA.sessions.length} sessions`;
    kpis(S); prepost(S); levels(S); triggers(S); refs(); reflections(S); sessions(S);
  }

  function kpis(S) {
    const pre = S.filter(s => s.pre), played = S.filter(s => (s.runs || []).length), post = S.filter(s => s.post);
    const paired = S.filter(s => s.pre && s.post);
    const moodD = mean(paired.map(s => s.post.mood - s.pre.mood));
    const above = mean(S.flatMap(s => (s.runs || []).map(r => r.aboveRatio)));
    const ch = S.flatMap(choicesOf), owned = ch.length ? ch.filter(c => c.good).length / ch.length : null;
    const recs = post.map(s => s.post.rec).filter(v => v != null);
    const nps = recs.length ? Math.round(100 * (recs.filter(v => v >= 9).length - recs.filter(v => v <= 6).length) / recs.length) : null;
    const tiles = [
      [S.length, "Sessions started", `${pre.length} finished check-in`],
      [played.length, "Played at least once", S.length ? pct(played.length / S.length) + " of sessions" : ""],
      [post.length, "Finished check-out", played.length ? pct(post.length / played.length) + " of players" : ""],
      [moodD == null ? "–" : (moodD >= 0 ? "+" : "") + moodD.toFixed(1), "Mood change, out of 10", paired.length ? `${f1(mean(paired.map(s => s.pre.mood)))} → ${f1(mean(paired.map(s => s.post.mood)))}` : "No pairs yet"],
      [pct(owned), "Triggers owned", `${ch.length} choices · ${pct(above)} time above`],
      [nps == null ? "–" : nps, "Recommend score", recs.length ? `NPS from ${recs.length} answers` : "No answers yet"],
    ];
    $("kpis").innerHTML = tiles.map(([v, l, s]) => `<div class="kpi"><b>${esc(v)}</b><span>${esc(l)}</span><small>${esc(s)}</small></div>`).join("");
  }

  function prepost(S) {
    const P = S.filter(s => s.pre && s.post);
    if (!P.length) { $("pp").innerHTML = `<p class="empty">Before-and-after results appear once players finish the check-out.</p>`; return; }
    const w = v => (v - 1) / 4 * 100;
    $("pp").innerHTML = ITEMS.map(it => {
      const b = mean(P.map(s => s.pre.items[it.k])), a = mean(P.map(s => s.post.items[it.k])), d = a - b;
      return `<div class="pp-row"><div class="q">${esc(it.t)} <b>${d >= 0 ? "+" : ""}${d.toFixed(2)}</b></div>
        <div class="barline"><span>Check-in</span><div class="track" title="Check-in average ${b.toFixed(2)}"><i class="b" style="width:${w(b)}%"></i></div><span>${b.toFixed(2)}</span></div>
        <div class="barline"><span>Check-out</span><div class="track" title="Check-out average ${a.toFixed(2)}"><i class="a" style="width:${w(a)}%"></i></div><span>${a.toFixed(2)}</span></div></div>`;
    }).join("") + `<div class="axis"><span></span><div><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div><span></span></div>`;
    $("ppNote").textContent = `Average agreement, 1 (strongly disagree) to 5 (strongly agree). ${P.length} sessions with both check-in and check-out.`;
  }

  function levels(S) {
    const played = S.filter(s => (s.runs || []).length);
    if (!played.length) { $("lvls").innerHTML = `<p class="empty">No runs yet.</p>`; return; }
    const counts = {}; played.forEach(s => { const l = bestLevel(s); counts[l] = (counts[l] || 0) + 1; });
    const max = Math.max(...Object.values(counts));
    $("lvls").innerHTML = LEVELS.map(L => {
      const c = counts[L.n] || 0;
      return `<div class="pp-row"><div class="q">Level ${L.n} · ${esc(L.name)} <b>${c}</b></div><div class="track" title="${c} sessions reached Level ${L.n}"><i class="s" style="width:${max ? c / max * 100 : 0}%"></i></div></div>`;
    }).join("");
  }

  function triggers(S) {
    const by = {}; S.flatMap(choicesOf).forEach(c => { (by[c.s] = by[c.s] || []).push(c); });
    const rows = SCENARIOS.map(sc => { const a = by[sc.id] || []; return { sc, n: a.length, good: a.length ? a.filter(c => c.good).length / a.length : null, to: a.length ? a.filter(c => c.timedOut).length / a.length : null, ms: mean(a.map(c => c.ms)) }; })
      .filter(r => r.n).sort((a, b) => a.good - b.good);
    if (!rows.length) { $("trig").innerHTML = `<tbody><tr><td class="empty">No trigger choices yet.</td></tr></tbody>`; return; }
    $("trig").innerHTML = `<thead><tr><th>Trigger</th><th>Below-the-line pull</th><th class="r">Shown</th><th>Owned it</th><th class="r">Froze</th><th class="r">Avg time</th></tr></thead><tbody>` +
      rows.map(r => `<tr><td>${esc(r.sc.t)}</td><td class="muted">${esc(r.sc.tag)}</td><td class="r">${r.n}</td><td style="white-space:nowrap"><span class="mini"><i style="width:${r.good * 100}%"></i></span>${pct(r.good)}</td><td class="r">${pct(r.to)}</td><td class="r">${(r.ms / 1000).toFixed(1)}s</td></tr>`).join("") + "</tbody>";
  }

  function siteBase() { return location.origin && location.origin !== "null" ? location.origin + location.pathname.replace(/admin\.html$/, "") : ""; }
  function refs() {
    const all = DATA.sessions;
    const friendTotal = all.filter(s => s.ref && isFriend(s.ref) && !isAdminCode(s.ref));
    const rows = DATA.refs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(r => {
      const ss = all.filter(s => s.ref === r.code);
      return `<tr><td><b>${esc(r.code)}</b></td><td>${esc(r.label)}</td><td class="r">${ss.length}</td><td class="r">${ss.filter(s => s.post).length}</td>
        <td><div class="rowbtns"><button class="btn sm" data-copy="${esc(r.code)}">Copy link</button>${DEMO ? "" : `<button class="btn sm danger" data-del="${esc(r.code)}">Delete</button>`}</div></td></tr>`;
    });
    const unknown = [...new Set(all.map(s => s.ref).filter(c => c && !isAdminCode(c) && !isFriend(c)))];
    unknown.forEach(c => { const ss = all.filter(s => s.ref === c); rows.push(`<tr><td><b>${esc(c)}</b></td><td class="muted">Typed by players, not created here</td><td class="r">${ss.length}</td><td class="r">${ss.filter(s => s.post).length}</td><td></td></tr>`); });
    rows.push(`<tr><td><span class="badge g">Friend invites</span></td><td class="muted">Players who arrived through another player’s share link</td><td class="r">${friendTotal.length}</td><td class="r">${friendTotal.filter(s => s.post).length}</td><td></td></tr>`);
    $("refs").innerHTML = `<thead><tr><th>Code</th><th>Label</th><th class="r">Sessions</th><th class="r">Finished</th><th></th></tr></thead><tbody>${rows.join("")}</tbody>`;
  }
  $("refs").addEventListener("click", async e => {
    const c = e.target.closest("[data-copy]"), d = e.target.closest("[data-del]");
    if (c) {
      const link = siteBase() + "?ref=" + c.dataset.copy + "#play";
      try { await navigator.clipboard.writeText(link); $("refMsg2").textContent = "Copied: " + link; } catch (x) { $("refMsg2").textContent = "Link: " + link; }
    }
    if (d) {
      if (d.dataset.armed !== "1") { d.dataset.armed = "1"; d.textContent = "Confirm delete"; return; }
      await Store.adminAction(pw, { action: "deleteRef", code: d.dataset.del }); $("refMsg2").textContent = `Deleted ${d.dataset.del}. Sessions that used it keep the code.`; load();
    }
  });
  $("refForm").addEventListener("submit", async e => {
    e.preventDefault();
    const code = $("newCode").value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, ""), label = $("newLabel").value.trim();
    if (code.length < 2) { $("refMsg2").textContent = "Codes need at least 2 letters or numbers (A–Z, 0–9, hyphen)."; return; }
    if (DEMO) { $("refMsg2").textContent = "Sample mode: codes aren’t saved."; return; }
    if (DATA.refs.some(r => r.code === code)) { $("refMsg2").textContent = `${code} already exists.`; return; }
    try { await Store.adminAction(pw, { action: "createRef", code, label }); $("refMsg2").textContent = `Created ${code}. Share the link with Copy link.`; $("refForm").reset(); load(); }
    catch (x) { $("refMsg2").textContent = x.message; }
  });

  function reflections(S) {
    const a = S.filter(s => s.post && s.post.choose).sort((x, y) => y.post.at - x.post.at).slice(0, 12);
    $("reflect").innerHTML = a.length ? a.map(s => `<blockquote>${esc(s.post.choose)}<cite>${esc(s.age)} · ${fmtDate(s.post.at)}${s.ref ? " · " + esc(s.ref) : ""}</cite></blockquote>`).join("") : `<p class="empty">No answers yet.</p>`;
  }

  function sessions(S) {
    if (!S.length) { $("sess").innerHTML = `<tbody><tr><td class="empty">No sessions match. Players appear here as soon as they finish the first step.</td></tr></tbody>`; return; }
    const head = `<thead><tr><th>Started</th><th>Code</th><th>Age</th><th class="r">Mood</th><th class="r">Statements</th><th class="r">Runs</th><th class="r">Best XP</th><th>Level</th><th class="r">Owned</th><th>Status</th></tr></thead>`;
    const body = S.slice(0, shown).map(s => {
      const ch = choicesOf(s), lv = bestLevel(s), a = itemAvg(s.pre && s.pre.items), b = itemAvg(s.post && s.post.items);
      const status = s.post ? `<span class="badge y">Finished</span>` : (s.runs || []).length ? `<span class="badge">Played</span>` : s.pre ? `<span class="badge g">Checked in</span>` : `<span class="badge g">Started</span>`;
      const row = `<tr class="click${openId === s.id ? " open" : ""}" data-id="${esc(s.id)}" tabindex="0"><td style="white-space:nowrap">${fmtDate(s.createdAt)}</td><td>${esc(s.ref) || '<span class="muted">–</span>'}</td><td>${esc(s.age)}</td>
        <td class="r">${s.pre ? s.pre.mood : "–"}${s.post ? " → " + s.post.mood : ""}</td><td class="r">${f1(a)}${b != null ? " → " + f1(b) : ""}</td><td class="r">${(s.runs || []).length}</td><td class="r">${bestXp(s).toLocaleString()}</td>
        <td>${lv < 6 ? lv : "–"}</td><td class="r">${ch.length ? ch.filter(c => c.good).length + "/" + ch.length : "–"}</td><td>${status}</td></tr>`;
      return row + (openId === s.id ? detail(s) : "");
    }).join("");
    const more = S.length > shown ? `<tr><td colspan="10"><button class="btn sm" data-more>Show ${Math.min(50, S.length - shown)} more of ${S.length - shown}</button></td></tr>` : "";
    $("sess").innerHTML = head + "<tbody>" + body + more + "</tbody>";
  }
  function detail(s) {
    const it = k => `${s.pre ? s.pre.items[k] : "–"} → ${s.post ? s.post.items[k] : "–"}`;
    const runs = (s.runs || []).map((r, i) => `Run ${i + 1}: ${r.xp.toLocaleString()} XP, Level ${r.level}, ${Math.round(r.aboveRatio * 100)}% above, ${r.durationS}s, ${(r.choices || []).filter(c => c.good).length}/${(r.choices || []).length} owned`).join("<br>") || "No runs";
    return `<tr class="detail"><td colspan="10"><div class="dgrid">
      <div><h4>Statements, check-in → check-out</h4>${ITEMS.map(x => `${esc(x.t)} <b class="num">${it(x.k)}</b>`).join("<br>")}</div>
      <div><h4>Runs</h4>${runs}</div>
      <div><h4>Check-out</h4>${s.post ? `Recommend: ${s.post.rec == null ? "–" : s.post.rec + "/10"}<br>“${esc(s.post.choose || "No answer")}”` : "Not finished"}
        <h4 style="margin-top:12px">Record</h4>ID ${esc(s.id)} · share code ${esc(s.shareCode)} · ${esc(s.device)}
        ${DEMO ? "" : `<div style="margin-top:12px"><button class="btn sm danger" data-delsess="${esc(s.id)}">Delete session</button></div>`}</div>
    </div></td></tr>`;
  }
  $("sess").addEventListener("click", async e => {
    const del = e.target.closest("[data-delsess]");
    if (del) {
      if (del.dataset.armed !== "1") { del.dataset.armed = "1"; del.textContent = "Confirm: delete for good"; return; }
      await Store.adminAction(pw, { action: "deleteSession", id: del.dataset.delsess }); openId = null; load(); return;
    }
    if (e.target.closest("[data-more]")) { shown += 50; sessions(filtered()); return; }
    const tr = e.target.closest("tr.click"); if (!tr) return;
    openId = openId === tr.dataset.id ? null : tr.dataset.id; sessions(filtered());
  });
  $("sess").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("tr.click")) e.target.click(); });

  /* ---------- CSV ---------- */
  $("csv").addEventListener("click", () => {
    const cols = ["id", "createdAt", "ref", "age", "device", "preMood", ...ITEMS.map(i => "pre_" + i.k), "runs", "bestXp", "bestLevel", "avgAbove", "choices", "owned", "timedOut", "postMood", ...ITEMS.map(i => "post_" + i.k), "recommend", "chooseNext", "shareCode"];
    const q = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = filtered().map(s => { const ch = choicesOf(s); return [
      s.id, new Date(s.createdAt).toISOString(), s.ref, s.age, s.device, s.pre && s.pre.mood, ...ITEMS.map(i => s.pre && s.pre.items[i.k]),
      (s.runs || []).length, bestXp(s), bestLevel(s) < 6 ? bestLevel(s) : "", mean((s.runs || []).map(r => r.aboveRatio)), ch.length, ch.filter(c => c.good).length, ch.filter(c => c.timedOut).length,
      s.post && s.post.mood, ...ITEMS.map(i => s.post && s.post.items[i.k]), s.post && s.post.rec, s.post && s.post.choose, s.shareCode].map(q).join(","); });
    const blob = new Blob([cols.join(",") + "\n" + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `line-of-choice-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a); a.click(); a.remove();
  });

  load();
})();
