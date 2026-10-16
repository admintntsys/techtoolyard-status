// Runs in GitHub Actions every 5 minutes. No dependencies; Node 20+.
// Writes status.json (current state) and history.json (status changes only).
// LEGAL: facts only. No uptime percentages, no guarantees, and nothing about
// data or security incidents is ever written here; those go in INCIDENTS.md by hand.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { renderMarkdown } from "./markdown.mjs";

const root = new URL("..", import.meta.url).pathname;
const read = (f, d) => (existsSync(root + f) ? JSON.parse(readFileSync(root + f, "utf8")) : d);
export const CONFIRM_FAILURES = 2; // consecutive failed checks before an app shows as not responding
export const SLOW_MS = 8000;
export const HEARTBEAT_MIN = 30; // commit at least this often even when nothing changed
const TIMEOUT_MS = 15000;
const HISTORY_MAX = 500;

async function timedFetch(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: "follow", headers: { "user-agent": "techtoolyard-status-checker" } });
    const body = await res.text();
    return { ok: res.ok, status: res.status, ms: Date.now() - start, body };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - start, body: "" };
  } finally {
    clearTimeout(t);
  }
}

// One app check result -> raw observation.
export function classifyApp(r) {
  if (!r.ok) return "down";
  if (r.ms > SLOW_MS) return "slow";
  return "up";
}

// Apply the confirm-failures rule using the previous state.
export function nextAppState(prev, observed) {
  const fails = observed === "down" ? (prev?.fails ?? 0) + 1 : 0;
  let state = observed;
  if (observed === "down" && fails < CONFIRM_FAILURES) state = prev?.state && prev.state !== "down" ? prev.state : "up";
  return { state, fails };
}

// Provider APIs -> { state: "none" | "minor" | "major" | "unknown", text }
export function parseCloudflare(r) {
  try {
    const j = JSON.parse(r.body);
    const ind = j.status?.indicator;
    const text = String(j.status?.description ?? "").slice(0, 200);
    // "maintenance" is scheduled work, not degradation: no banner.
    if (ind === "none" || ind === "maintenance") return { state: "none", text };
    if (ind === "minor") return { state: "minor", text };
    if (ind === "major" || ind === "critical") return { state: "major", text };
  } catch {}
  return { state: "unknown", text: "" };
}
export function parseStripe(r) {
  try {
    const j = JSON.parse(r.body);
    const s = j.largestatus;
    const text = String(j.message ?? "").slice(0, 200);
    if (s === "up") return { state: "none", text };
    if (s === "degraded") return { state: "minor", text };
    if (s === "down") return { state: "major", text };
  } catch {}
  return { state: "unknown", text: "" };
}
const parsers = { cloudflare: parseCloudflare, stripe: parseStripe };

export function overall(apps, providers) {
  if (apps.some((a) => a.state === "down")) return "down";
  if (apps.some((a) => a.state === "slow") || providers.some((p) => p.state === "minor" || p.state === "major")) return "degraded";
  return "up";
}

async function main() {
  const cfg = read("config.json");
  const prev = read("status.json", {});
  const prevApps = Object.fromEntries((prev.apps ?? []).map((a) => [a.key, a]));
  const prevProv = Object.fromEntries((prev.providers ?? []).map((p) => [p.key, p]));
  const now = new Date().toISOString();

  const apps = await Promise.all(cfg.apps.map(async (a) => {
    const r = await timedFetch(a.url);
    const { state, fails } = nextAppState(prevApps[a.key], classifyApp(r));
    const p = prevApps[a.key];
    return { key: a.key, name: a.name, state, fails, since: p && p.state === state ? p.since : now };
  }));
  const providers = await Promise.all(cfg.providers.map(async (p) => {
    const parsed = parsers[p.key](await timedFetch(p.api));
    // A failed fetch of the provider's API keeps the last known state instead of guessing.
    const q = prevProv[p.key];
    const s = parsed.state === "unknown" && q ? { state: q.state, text: q.text } : parsed;
    return { key: p.key, name: p.name, page: p.page, state: s.state, text: s.text, since: q && q.state === s.state ? q.since : now };
  }));

  const notesMd = existsSync(root + "INCIDENTS.md") ? readFileSync(root + "INCIDENTS.md", "utf8") : "";
  const status = { checkedAt: now, overall: overall(apps, providers), apps, providers, notesHtml: renderMarkdown(notesMd) };

  const sig = (s) => JSON.stringify([s.overall, (s.apps ?? []).map((a) => [a.key, a.state]), (s.providers ?? []).map((p) => [p.key, p.state, p.text]), s.notesHtml]);
  const changed = sig(status) !== sig(prev);
  const stale = !prev.checkedAt || Date.now() - Date.parse(prev.checkedAt) > HEARTBEAT_MIN * 60000;

  if (changed) {
    const history = read("history.json", []);
    for (const a of apps) if ((prevApps[a.key]?.state ?? "up") !== a.state) history.unshift({ at: now, key: a.key, name: a.name, state: a.state });
    for (const p of providers) if ((prevProv[p.key]?.state ?? "none") !== p.state) history.unshift({ at: now, key: p.key, name: p.name, state: p.state, text: p.text });
    writeFileSync(root + "history.json", JSON.stringify(history.slice(0, HISTORY_MAX), null, 2) + "\n");
  }
  if (changed || stale) writeFileSync(root + "status.json", JSON.stringify(status, null, 2) + "\n");
  console.log(`overall=${status.overall} changed=${changed} heartbeat=${stale && !changed}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
