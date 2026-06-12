import { toSegments } from "../lib/richText";
import { linkifyText } from "../lib/linkifyText";

export default function RichText({ value, fieldId }) {
  const segments = toSegments(value);

  return (
    <span data-rich-field={fieldId}>
      {segments.map((seg, i) => {
        const style = {};
        if (seg.style?.bold) style.fontWeight = 700;
        if (seg.style?.italic) style.fontStyle = "italic";
        if (seg.style?.underline) style.textDecoration = "underline";
        if (seg.style?.color) style.color = seg.style.color;
        if (seg.style?.fontFamily) style.fontFamily = seg.style.fontFamily;

        const parts = linkifyText(seg.text);
        return parts.map((part, j) => {
          const key = `${i}-${j}`;
          if (part.type === "link") {
            return (
              <a
                key={key}
                href={part.href}
                target="_blank"
                rel="noreferrer"
                style={style}
                data-rich-link
              >
                {part.text}
              </a>
            );
          }

          return splitMetricText(part.text).map((metricPart, k) => (
            <span
              key={`${key}-${k}`}
              style={metricPart.metric ? { ...style, fontWeight: 700 } : style}
              data-rich-metric={metricPart.metric ? "true" : undefined}
            >
              {metricPart.text}
            </span>
          ));
        });
      })}
    </span>
  );
}

const METRIC_RE = /(\d+(?:\.\d+)?(?:\s?[-–]\s?\d+(?:\.\d+)?)?(?:\s?(?:%|w|W|万|亿|条|个|个月|月|小时|分钟|倍|分|年|次|套|张|人|天))?)/g;

function splitMetricText(text) {
  const parts = [];
  let lastIndex = 0;

  for (const match of text.matchAll(METRIC_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({ text: text.slice(lastIndex, start), metric: false });
    }
    parts.push({ text: match[0], metric: true });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), metric: false });
  }

  return parts.length ? parts : [{ text, metric: false }];
}
