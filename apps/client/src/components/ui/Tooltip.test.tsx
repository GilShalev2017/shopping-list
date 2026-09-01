import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from './Tooltip';
import { mockTriggerRect } from '@/test/truncation';

const setup = (props: Partial<React.ComponentProps<typeof Tooltip>> = {}) =>
  render(
    <Tooltip label="Full product name" data-testid="trigger" {...props}>
      <span>Truncated…</span>
    </Tooltip>,
  );

describe('Tooltip', () => {
  it('renders its children', () => {
    setup();
    expect(screen.getByText('Truncated…')).toBeInTheDocument();
  });

  it('shows nothing until hovered', () => {
    setup();
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('shows the label on hover and hides it again on leave', async () => {
    const user = userEvent.setup();
    setup();

    await user.hover(screen.getByTestId('trigger'));
    expect(screen.getByTestId('tooltip')).toHaveTextContent('Full product name');

    await user.unhover(screen.getByTestId('trigger'));
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('renders into a portal on document.body, not inside the trigger', async () => {
    const user = userEvent.setup();
    const { container } = setup();

    await user.hover(screen.getByTestId('trigger'));

    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip.parentElement).toBe(document.body);
    expect(container.contains(tooltip)).toBe(false);
  });

  it('positions itself from the trigger rectangle', async () => {
    mockTriggerRect({ top: 200, left: 100, width: 240 });
    const user = userEvent.setup();
    setup();

    await user.hover(screen.getByTestId('trigger'));

    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toHaveStyle({ top: '200px' });
    // Anchored to the horizontal centre of the trigger: 100 + 240 / 2.
    expect(tooltip).toHaveStyle({ left: '220px' });
  });

  it('clamps the position so a trigger near the window edge stays on screen', async () => {
    mockTriggerRect({ top: 10, left: -400, width: 100 });
    const user = userEvent.setup();
    setup();

    await user.hover(screen.getByTestId('trigger'));

    // Centre would be -350; clamped to the 12px edge padding.
    expect(screen.getByTestId('tooltip')).toHaveStyle({ left: '12px' });
  });

  it('stays on screen when the window reports no width', async () => {
    mockTriggerRect({ top: 10, left: 900, width: 100 });
    const original = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 0 });

    const user = userEvent.setup();
    setup();
    await user.hover(screen.getByTestId('trigger'));

    // Nothing sensible to clamp against, so it falls back to the edge padding
    // rather than positioning the bubble outside the viewport.
    expect(screen.getByTestId('tooltip')).toHaveStyle({ left: '12px' });

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: original });
  });

  it('is hidden from assistive tech, because the text is already in the DOM', async () => {
    const user = userEvent.setup();
    setup();

    await user.hover(screen.getByTestId('trigger'));

    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toHaveAttribute('aria-hidden', 'true');
    expect(tooltip).toHaveAttribute('role', 'tooltip');
    // aria-hidden keeps it out of the accessibility tree, so a role query must
    // opt in to hidden elements to see it at all.
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('tooltip', { hidden: true })).toBe(tooltip);
  });

  it('dismisses on scroll, since fixed coordinates go stale', async () => {
    const user = userEvent.setup();
    setup();

    await user.hover(screen.getByTestId('trigger'));
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('dismisses on resize', async () => {
    const user = userEvent.setup();
    setup();

    await user.hover(screen.getByTestId('trigger'));
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('renders children bare and never shows a bubble when disabled', async () => {
    const user = userEvent.setup();
    setup({ enabled: false });

    expect(screen.getByText('Truncated…')).toBeInTheDocument();
    expect(screen.queryByTestId('trigger')).not.toBeInTheDocument();

    await user.hover(screen.getByText('Truncated…'));
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('forwards a custom class to the trigger in both modes', () => {
    const { container, unmount } = setup({ className: 'grow' });
    expect(container.querySelector('.grow')).toBeInTheDocument();
    unmount();

    const disabled = setup({ className: 'grow', enabled: false });
    expect(disabled.container.querySelector('.grow')).toBeInTheDocument();
  });
});
