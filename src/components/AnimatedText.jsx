import { useEffect, useRef, useState } from "react";

/**
 * Pure typewriter effect — text appears one character at a time,
 * like someone is sitting there typing it out.
 */
export default function AnimatedText({ after, active, onComplete }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const text = after || "";
  const total = text.length;

  useEffect(() => {
    if (!active || total === 0) {
      setVisibleCount(total);
      return;
    }

    setVisibleCount(0);
    startRef.current = null;

    const msPerChar = Math.max(40, Math.min(80, 4000 / total));

    function tick(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const count = Math.min(Math.floor(elapsed / msPerChar), total);
      setVisibleCount(count);

      if (count < total) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onComplete?.();
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, total, onComplete]);

  const done = visibleCount >= total;

  return (
    <span className="typewriter-wrapper">
      <span className="typewriter-text">{text.slice(0, visibleCount)}</span>
      {!done && <span className="typewriter-cursor">|</span>}
    </span>
  );
}
