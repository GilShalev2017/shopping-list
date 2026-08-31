import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders its children and defaults to type="button"', () => {
    render(<Button>Add</Button>);
    const button = screen.getByRole('button', { name: 'Add' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
  });

  it('honours an explicit submit type', () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAttribute('type', 'submit');
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Click</Button>);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick while disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button onClick={onClick} disabled>
        Click
      </Button>,
    );

    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is disabled and marked busy while loading', () => {
    render(<Button loading>Saving</Button>);
    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('is not marked busy when idle', () => {
    render(<Button>Idle</Button>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
  });

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
    'applies the %s variant class',
    (variant) => {
      const { container } = render(<Button variant={variant}>V</Button>);
      expect(container.firstElementChild?.className).toContain(variant);
    },
  );

  it.each(['sm', 'lg'] as const)('applies the %s size class', (size) => {
    const { container } = render(<Button size={size}>S</Button>);
    expect(container.firstElementChild?.className).toContain(size);
  });

  it('does not add a size class for the default size', () => {
    const { container } = render(<Button size="md">M</Button>);
    expect(container.firstElementChild?.className).not.toMatch(/\bsm\b|\blg\b/);
  });

  it('supports block and icon-only modifiers plus a custom class', () => {
    const { container } = render(
      <Button block iconOnly className="extra" aria-label="Close">
        ×
      </Button>,
    );
    const className = container.firstElementChild?.className ?? '';
    expect(className).toContain('block');
    expect(className).toContain('icon');
    expect(className).toContain('extra');
  });
});
