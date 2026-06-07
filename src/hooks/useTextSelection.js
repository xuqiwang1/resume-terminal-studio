import { useCallback, useEffect, useRef, useState } from "react";

export function useTextSelection(containerRef) {
  const [selInfo, setSelInfo] = useState(null);
  const debounceRef = useRef(null);

  const detect = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setSelInfo(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const container = containerRef?.current;
    if (!container || !container.contains(range.commonAncestorContainer)) {
      setSelInfo(null);
      return;
    }

    let node = range.startContainer;
    let fieldEl = null;
    while (node && node !== container) {
      if (node.nodeType === 1 && node.dataset?.richField) {
        fieldEl = node;
        break;
      }
      node = node.parentNode;
    }

    if (!fieldEl) {
      setSelInfo(null);
      return;
    }

    const fieldId = fieldEl.dataset.richField;
    const preRange = document.createRange();
    preRange.selectNodeContents(fieldEl);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const endOffset = startOffset + range.toString().length;

    if (startOffset === endOffset) {
      setSelInfo(null);
      return;
    }

    setSelInfo({ fieldId, startOffset, endOffset });
  }, [containerRef]);

  useEffect(() => {
    const onSelChange = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(detect, 60);
    };
    document.addEventListener("selectionchange", onSelChange);
    return () => {
      document.removeEventListener("selectionchange", onSelChange);
      clearTimeout(debounceRef.current);
    };
  }, [detect]);

  return selInfo;
}
