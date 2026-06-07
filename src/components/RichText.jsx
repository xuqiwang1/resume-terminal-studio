import { toSegments } from "../lib/richText";

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

        const hasStyle = Object.keys(style).length > 0;
        return hasStyle
          ? <span key={i} style={style}>{seg.text}</span>
          : <span key={i}>{seg.text}</span>;
      })}
    </span>
  );
}
