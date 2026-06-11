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

          return (
            <span key={key} style={style}>
              {part.text}
            </span>
          );
        });
      })}
    </span>
  );
}
