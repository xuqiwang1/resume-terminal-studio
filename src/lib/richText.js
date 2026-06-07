/**
 * Normalize a text field: if it's a plain string, wrap into RichSegment[].
 * If already RichSegment[], return as-is.
 */
export function toSegments(value) {
  if (!value) return [{ text: "", style: {} }];
  if (typeof value === "string") return [{ text: value, style: {} }];
  if (Array.isArray(value)) return value;
  return [{ text: String(value), style: {} }];
}

/** Convert RichSegment[] back to plain text (for backward compat) */
export function toPlainText(segments) {
  if (typeof segments === "string") return segments;
  if (!Array.isArray(segments)) return String(segments || "");
  return segments.map((s) => s.text).join("");
}

/**
 * Apply a style toggle to a character range within segments.
 * Returns a new segments array with the style applied.
 */
export function applyStyleToRange(segments, startOffset, endOffset, styleKey, styleValue) {
  const result = [];
  let cursor = 0;

  for (const seg of segments) {
    const segStart = cursor;
    const segEnd = cursor + seg.text.length;

    if (segEnd <= startOffset || segStart >= endOffset) {
      result.push({ ...seg, style: { ...seg.style } });
    } else {
      // before selection
      if (segStart < startOffset) {
        result.push({ text: seg.text.slice(0, startOffset - segStart), style: { ...seg.style } });
      }
      // selected part
      const sliceStart = Math.max(0, startOffset - segStart);
      const sliceEnd = Math.min(seg.text.length, endOffset - segStart);
      const newStyle = { ...seg.style };
      if (styleKey === "bold" || styleKey === "italic" || styleKey === "underline") {
        newStyle[styleKey] = !seg.style[styleKey];
      } else if (styleValue === undefined || styleValue === null) {
        delete newStyle[styleKey];
      } else {
        newStyle[styleKey] = styleValue;
      }
      result.push({ text: seg.text.slice(sliceStart, sliceEnd), style: newStyle });
      // after selection
      if (segEnd > endOffset) {
        result.push({ text: seg.text.slice(endOffset - segStart), style: { ...seg.style } });
      }
    }
    cursor = segEnd;
  }

  return mergeAdjacent(result);
}

function mergeAdjacent(segments) {
  const out = [];
  for (const seg of segments) {
    if (seg.text === "") continue;
    const prev = out[out.length - 1];
    if (prev && styleEqual(prev.style, seg.style)) {
      prev.text += seg.text;
    } else {
      out.push(seg);
    }
  }
  return out.length ? out : [{ text: "", style: {} }];
}

function styleEqual(a, b) {
  const keysA = Object.keys(a || {});
  const keysB = Object.keys(b || {});
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
}
