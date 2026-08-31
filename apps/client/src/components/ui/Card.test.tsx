import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders children without a header when no title is given', () => {
    render(<Card>Body</Card>);
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders the title as a level-2 heading', () => {
    render(<Card title="Your cart">Body</Card>);
    expect(screen.getByRole('heading', { level: 2, name: 'Your cart' })).toBeInTheDocument();
  });

  it('renders the action slot only when a title exists', () => {
    const { rerender } = render(
      <Card title="Cart" action="3 lines">
        Body
      </Card>,
    );
    expect(screen.getByText('3 lines')).toBeInTheDocument();

    rerender(<Card action="3 lines">Body</Card>);
    expect(screen.queryByText('3 lines')).not.toBeInTheDocument();
  });

  it('renders as a section by default and honours the `as` prop', () => {
    const { container, rerender } = render(<Card>Body</Card>);
    expect(container.firstElementChild?.tagName).toBe('SECTION');

    rerender(<Card as="aside">Body</Card>);
    expect(container.firstElementChild?.tagName).toBe('ASIDE');
  });

  it('drops body padding when flush', () => {
    const { container } = render(<Card flush>Body</Card>);
    const body = container.querySelector('section > div');
    expect(body?.className).toContain('bodyFlush');
  });

  it('forwards a custom class name', () => {
    const { container } = render(<Card className="sticky">Body</Card>);
    expect(container.firstElementChild?.className).toContain('sticky');
  });
});
