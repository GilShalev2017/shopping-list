import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  /** The text shown in the bubble. */
  label: string;
  /** The hover target. */
  children: ReactNode;
  /**
   * When false the children render bare with no hover behaviour. The cart uses
   * this so a tooltip only appears for names that are actually clipped.
   */
  enabled?: boolean;
  className?: string;
  'data-testid'?: string;
}

interface Position {
  top: number;
  left: number;
}

const EDGE_PADDING = 12;

/**
 * A hover tooltip rendered through a portal on <body>.
 *
 * The portal matters here: the cart list is a scroll container
 * (`overflow-y: auto`), so a bubble positioned above the first row would be
 * clipped if it lived inside the row. Portalling out and positioning in
 * viewport coordinates with `position: fixed` sidesteps that entirely.
 *
 * Deliberately no `aria-describedby` and no tab stop: the label duplicates text
 * that is already present in the DOM and fully available to screen readers —
 * CSS ellipsis truncation is a visual effect only. Adding ARIA here would make
 * assistive tech announce the same product name twice, and adding `tabIndex`
 * would insert a focus stop that offers a keyboard user nothing they cannot
 * already read. The bubble is `aria-hidden` for the same reason.
 */
export const Tooltip = ({
  label,
  children,
  enabled = true,
  className,
  'data-testid': testId,
}: TooltipProps) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const hide = useCallback(() => setPosition(null), []);

  const show = useCallback(() => {
    const element = triggerRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth || 0;

    setPosition({
      top: rect.top,
      // Anchor to the centre of the trigger, clamped so a long name near the
      // edge of the window cannot push the bubble off-screen.
      left: Math.min(
        Math.max(rect.left + rect.width / 2, EDGE_PADDING),
        Math.max(viewportWidth - EDGE_PADDING, EDGE_PADDING),
      ),
    });
  }, []);

  // Fixed coordinates go stale the moment anything scrolls or the window
  // resizes, so dismiss rather than chase the anchor.
  useEffect(() => {
    if (!position) return;

    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [position, hide]);

  if (!enabled) {
    return (
      <span className={[styles.trigger, className].filter(Boolean).join(' ')}>{children}</span>
    );
  }

  return (
    <>
      <span
        ref={triggerRef}
        className={[styles.trigger, className].filter(Boolean).join(' ')}
        // Mouse rather than pointer events: a hover tooltip is a pointer-device
        // affordance by definition, and mouseenter/mouseleave behave
        // consistently everywhere, including in jsdom under test.
        onMouseEnter={show}
        onMouseLeave={hide}
        data-testid={testId}
      >
        {children}
      </span>

      {position
        ? createPortal(
            <span
              role="tooltip"
              aria-hidden="true"
              data-testid="tooltip"
              className={styles.tooltip}
              style={{ top: position.top, left: position.left }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </>
  );
};

export default Tooltip;
