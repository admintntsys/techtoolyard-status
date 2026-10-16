(() => {
  const ACCENT = {}; // filled from config.json
  const APP_WORDS = { up: "Operational", slow: "Responding slowly", down: "Not responding" };
  const PROV_WORDS = { none: "No reported issues", minor: "Reports an issue", major: "Reports a major issue", unknown: "Status unavailable" };
  const OVERALL = { up: "All apps are operational", degraded: "Some services are degraded", down: "Some apps are not responding" };
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZoneName: "short" });

  function render(s, h, cfg) {
    for (const a of cfg.apps) ACCENT[a.key] = a.accent;
    document.body.dataset.overall = s.overall;
    $("overall-title").textContent = OVERALL[s.overall] || "Status";
    const age = (Date.now() - Date.parse(s.checkedAt)) / 60000;
    $("checked").textContent = `Last checked ${fmt(s.checkedAt)}.` + (age > 60 ? " The checks may be delayed." : "");
    const apps = $("apps"); apps.replaceChildren();
    for (const a of s.apps) {
      const li = el("li", `card state-${a.state}`); li.style.setProperty("--accent", ACCENT[a.key] || "#38BDF8");
      li.append(el("h3", null, a.name), el("p", "pill", APP_WORDS[a.state] || a.state), el("p", "muted small", `Since ${fmt(a.since)}`));
      apps.append(li);
    }
    const prov = $("providers"); prov.replaceChildren();
    for (const p of s.providers) {
      const li = el("li", `card prov-${p.state}`);
      li.append(el("h3", null, p.name), el("p", "pill", PROV_WORDS[p.state] || p.state));
      if (p.text) li.append(el("p", "small", `${p.name} says: “${p.text}”`));
      const a = el("a", "small", `${p.name} status page`); a.href = p.page; li.append(a);
      prov.append(li);
    }
    if (s.notesHtml && s.notesHtml.trim()) $("notes").innerHTML = s.notesHtml; // rendered from INCIDENTS.md, escaped at build
    const hist = $("history"); hist.replaceChildren();
    const recent = (h || []).slice(0, 20);
    if (!recent.length) hist.append(el("li", "muted", "No changes recorded yet."));
    for (const e of recent) {
      const words = e.key in ACCENT ? APP_WORDS[e.state] : PROV_WORDS[e.state];
      hist.append(el("li", null, `${fmt(e.at)}: ${e.name}: ${words || e.state}${e.text ? ` (“${e.text}”)` : ""}`));
    }
  }
  const get = (f) => fetch(`${f}?t=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  async function load() {
    const [s, h, cfg] = await Promise.all([get("status.json"), get("history.json"), get("config.json")]);
    if (s && cfg) render(s, h, cfg); else $("checked").textContent = "Could not load the latest check. Try again in a minute.";
  }
  load(); setInterval(load, 60000);
})();
