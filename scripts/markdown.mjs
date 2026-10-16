// Tiny, safe markdown subset for INCIDENTS.md: # headings, paragraphs, - lists,
// **bold**, *italic*, `code`, [text](https://link). All text is HTML-escaped.
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
}
export function renderMarkdown(md) {
  // Drop HTML comments (used for the template/instructions in INCIDENTS.md).
  const lines = md.replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/);
  const out = [];
  let para = [], list = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`), (para = []);
    if (list.length) out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`), (list = []);
  };
  for (const line of lines) {
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (h) { flush(); const n = Math.min(h[1].length + 1, 4); out.push(`<h${n}>${inline(h[2])}</h${n}>`); }
    else if (li) { if (para.length) flush(); list.push(li[1]); }
    else if (!line.trim()) flush();
    else { if (list.length) flush(); para.push(line.trim()); }
  }
  flush();
  return out.join("\n");
}
