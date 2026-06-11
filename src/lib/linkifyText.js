const LINK_CANDIDATE_RE = /\b(?:https?:\/\/[^\s<>"']+|mailto:[^\s<>"']+|www\.[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION_RE = /[),.;:!?，。；：！？、）】》]+$/;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function safeLinkHref(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return null;

  const candidate = raw.toLowerCase().startsWith("www.") ? `https://${raw}` : raw;

  try {
    const parsed = new URL(candidate);
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

export function linkifyText(value) {
  const text = String(value || "");
  if (!text) return [{ type: "text", text: "" }];

  const out = [];
  let cursor = 0;

  for (const match of text.matchAll(LINK_CANDIDATE_RE)) {
    const start = match.index ?? 0;
    let visible = match[0];
    const trailing = visible.match(TRAILING_PUNCTUATION_RE)?.[0] || "";
    if (trailing) visible = visible.slice(0, -trailing.length);

    const href = safeLinkHref(visible);
    if (!href) continue;

    if (start > cursor) out.push({ type: "text", text: text.slice(cursor, start) });
    out.push({ type: "link", text: visible, href });
    if (trailing) out.push({ type: "text", text: trailing });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) out.push({ type: "text", text: text.slice(cursor) });
  return out.length ? out : [{ type: "text", text }];
}
