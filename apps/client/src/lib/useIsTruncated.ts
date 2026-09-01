import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Reports whether an element's text is actually being clipped by a CSS
 * ellipsis, so a tooltip can be offered only when it adds information.
 *
 * Re-measures whenever the text changes (switching language changes the name)
 * and whenever the element is resized, which covers the responsive layout
 * collapsing the cart panel to full width.
 *
 * The 1px tolerance absorbs sub-pixel rounding: browsers report fractional
 * layout widths but `scrollWidth`/`clientWidth` are integers, so an untruncated
 * element can measure one pixel wider than its box.
 */
export const useIsTruncated = <T extends HTMLElement>(
  text: string,
): [RefObject<T | null>, boolean] => {
  const ref = useRef<T>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth + 1);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return [ref, isTruncated];
};
