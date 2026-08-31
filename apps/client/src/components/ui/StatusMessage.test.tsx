import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkeletonList, StatusMessage } from './StatusMessage';

describe('StatusMessage', () => {
  it('renders the title with a status role by default', () => {
    render(<StatusMessage title="Nothing here" />);
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Nothing here');
  });

  it('uses an alert role for the error tone', () => {
    render(<StatusMessage tone="error" title="Broken" description="Try later" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Broken');
    expect(alert).toHaveTextContent('Try later');
  });

  it('omits the description when not provided', () => {
    render(<StatusMessage title="Only title" />);
    expect(screen.getByRole('status').textContent).toContain('Only title');
  });

  it('renders an action slot', () => {
    render(<StatusMessage title="T" action={<button type="button">Retry</button>} />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('SkeletonList', () => {
  it('renders the requested number of placeholder rows', () => {
    const { container } = render(<SkeletonList rows={5} label="Loading" />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(5);
  });

  it('defaults to four rows and exposes an accessible busy label', () => {
    const { container } = render(<SkeletonList label="Loading the catalog" />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent('Loading the catalog');
  });
});
