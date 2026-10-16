import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { classifyApp, nextAppState, parseCloudflare, parseStripe, overall } from "../scripts/check.mjs";
import { renderMarkdown } from "../scripts/markdown.mjs";

test("one failure does not mark an app down; two do", () => {
  const a = nextAppState({ state: "up", fails: 0 }, "down");
  assert.equal(a.state, "up"); assert.equal(a.fails, 1);
  const b = nextAppState(a, "down");
  assert.equal(b.state, "down");
  assert.equal(nextAppState(b, "up").state, "up");
});
test("classify", () => {
  assert.equal(classifyApp({ ok: false, ms: 10 }), "down");
  assert.equal(classifyApp({ ok: true, ms: 9000 }), "slow");
  assert.equal(classifyApp({ ok: true, ms: 100 }), "up");
});
test("provider parsing", () => {
  assert.equal(parseCloudflare({ body: '{"status":{"indicator":"none","description":"All Systems Operational"}}' }).state, "none");
  assert.equal(parseCloudflare({ body: '{"status":{"indicator":"major","description":"x"}}' }).state, "major");
  assert.equal(parseCloudflare({ body: "<html>" }).state, "unknown");
  assert.equal(parseStripe({ body: '{"largestatus":"up","message":"All services are online."}' }).state, "none");
  assert.equal(parseStripe({ body: '{"largestatus":"degraded"}' }).state, "minor");
});
test("overall", () => {
  assert.equal(overall([{ state: "up" }], [{ state: "none" }]), "up");
  assert.equal(overall([{ state: "up" }], [{ state: "minor" }]), "degraded");
  assert.equal(overall([{ state: "down" }], [{ state: "none" }]), "down");
});
test("markdown escapes HTML and drops comments", () => {
  const h = renderMarkdown("<!-- hi -->\n## T\n<script>x</script> [a](https://x.com) [b](javascript:alert(1))");
  assert.ok(!h.includes("<script>")); assert.ok(h.includes('<a href="https://x.com">a</a>')); assert.ok(!h.includes('href="javascript'));
  assert.ok(!h.includes("hi"));
});
test("LEGAL: no uptime percentages, no ®, no guarantee wording, TechToolYard™ once", () => {
  const files = ["index.html", "app.js", "scripts/check.mjs"].map((f) => readFileSync(new URL("../" + f, import.meta.url), "utf8"));
  const page = files.join("\n");
  assert.ok(!/\d+(\.\d+)?\s*%/.test(page), "no percentages");
  assert.ok(!page.includes("®"));
  assert.ok(!/\buptime\s+(percentage|of)\b|\bguarantee[ds]?\b|\bSLA\b/i.test(files[0] + files[1]));
  assert.equal((files[0].match(/™/g) || []).length, 1);
});
test("no data/security incident wording in automatic output", () => {
  const src = readFileSync(new URL("../scripts/check.mjs", import.meta.url), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/breach|leak|compromis|hack/i.test(src));
});
test("only expected apps", () => {
  const cfg = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8"));
  const keys = cfg.apps.map((a) => a.key).sort();
  assert.deepEqual(keys, ["ariavue", "domainvera", "duepath", "licenscope", "readinex", "renevo", "scanmetry", "steadivo", "techtoolyard"]);
});
