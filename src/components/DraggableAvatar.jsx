import { useCallback, useEffect, useRef, useState } from "react";

export default function DraggableAvatar({ src, position, onPositionChange, size = 56, className = "" }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const origin = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  const pos = position || { x: 0, y: 0 };

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    origin.current = {
      x: pos.x,
      y: pos.y,
      startX: e.clientX,
      startY: e.clientY,
    };
    ref.current?.setPointerCapture(e.pointerId);
  }, [pos.x, pos.y]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - origin.current.startX;
    const dy = e.clientY - origin.current.startY;
    const el = ref.current;
    if (el) {
      el.style.transform = `translate(${origin.current.x + dx}px, ${origin.current.y + dy}px)`;
    }
  }, []);

  const onPointerUp = useCallback((e) => {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = e.clientX - origin.current.startX;
    const dy = e.clientY - origin.current.startY;
    const newX = origin.current.x + dx;
    const newY = origin.current.y + dy;
    onPositionChange?.({ x: newX, y: newY });
  }, [onPositionChange]);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    }
  }, [pos.x, pos.y]);

  return (
    <div
      ref={ref}
      className={`draggable-avatar ${className}`.trim()}
      style={{
        width: size,
        height: size,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <img src={src} alt="" draggable={false} />
      <div className="drag-handle" title="拖动头像" />
    </div>
  );
}
