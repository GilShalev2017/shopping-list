import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectField, TextField } from './Field';

describe('TextField', () => {
  it('associates the label with the input', () => {
    render(<TextField label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('is not marked invalid when there is no error', () => {
    render(<TextField label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('renders an error with an alert role and links it via aria-describedby', () => {
    render(<TextField label="Email" error="Invalid address" />);
    const input = screen.getByLabelText('Email');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Invalid address');
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);
  });

  it('renders a hint and links it when there is no error', () => {
    render(<TextField label="Email" hint="We never share it" />);
    const input = screen.getByLabelText('Email');
    const hint = screen.getByText('We never share it');
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('hides the hint once an error is present', () => {
    render(<TextField label="Email" hint="We never share it" error="Required" />);
    expect(screen.queryByText('We never share it')).not.toBeInTheDocument();
  });

  it('shows the required marker and sets aria-required', () => {
    render(<TextField label="Email" required requiredLabel="Required" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('omits the marker when no requiredLabel is supplied', () => {
    render(<TextField label="Email" required />);
    expect(screen.queryByText('Required')).not.toBeInTheDocument();
  });

  it('forwards typing to onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TextField label="Email" value="" onChange={onChange} />);

    await user.type(screen.getByLabelText('Email'), 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('gives each instance a unique control id', () => {
    render(
      <>
        <TextField label="First" />
        <TextField label="Second" />
      </>,
    );
    expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
  });
});

describe('SelectField', () => {
  it('renders its options and reports the selected value', () => {
    render(
      <SelectField label="Category" value="1" onChange={() => {}}>
        <option value="">Pick one</option>
        <option value="1">Dairy</option>
      </SelectField>,
    );

    const select = screen.getByLabelText('Category');
    expect(select).toHaveValue('1');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('fires onChange with the chosen value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SelectField label="Category" value="" onChange={onChange}>
        <option value="">Pick one</option>
        <option value="2">Produce</option>
      </SelectField>,
    );

    await user.selectOptions(screen.getByLabelText('Category'), '2');
    expect(onChange).toHaveBeenCalled();
  });

  it('supports the disabled state', () => {
    render(
      <SelectField label="Product" disabled>
        <option value="">None</option>
      </SelectField>,
    );
    expect(screen.getByLabelText('Product')).toBeDisabled();
  });

  it('marks itself invalid and links the error', () => {
    render(
      <SelectField label="Category" error="Choose a category">
        <option value="">None</option>
      </SelectField>,
    );

    const select = screen.getByLabelText('Category');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });
});
