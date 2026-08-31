import { useState, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { uiState } from '@/test/fixtures';
import { QuantityStepper } from './QuantityStepper';
import { MAX_QUANTITY } from '@/features/cart/cartSlice';

type StepperProps = ComponentProps<typeof QuantityStepper>;

/**
 * The stepper is a controlled component, so the harness owns the value and
 * feeds it back — otherwise typing into it would fight a frozen prop.
 */
const Harness = ({
  initialValue,
  onChange,
  ...props
}: Omit<StepperProps, 'value'> & { initialValue: number }) => {
  const [value, setValue] = useState(initialValue);
  return (
    <QuantityStepper
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      {...props}
    />
  );
};

const setup = (props: Partial<StepperProps> = {}) => {
  const onChange = vi.fn();
  const { value = 2, label = 'Quantity', ...rest } = props;
  const utils = renderWithProviders(
    <Harness initialValue={value} onChange={onChange} label={label} {...rest} />,
    { preloadedState: { ui: uiState('en') } },
  );
  return { onChange, ...utils };
};

describe('QuantityStepper', () => {
  it('renders the current value in an accessible spin field', () => {
    setup({ value: 3 });
    expect(screen.getByLabelText('Quantity')).toHaveValue(3);
  });

  it('increments and decrements by one', async () => {
    const { onChange, user } = setup({ value: 2 });

    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    expect(screen.getByLabelText('Quantity')).toHaveValue(3);

    await user.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(screen.getByLabelText('Quantity')).toHaveValue(2);
  });

  it('disables decrement at the minimum and increment at the maximum', () => {
    const { unmount } = setup({ value: 1 });
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeEnabled();
    unmount();

    setup({ value: MAX_QUANTITY });
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('respects custom min and max bounds', () => {
    setup({ value: 5, min: 5, max: 5 });
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('replaces the value when a digit is typed (the field selects on focus)', async () => {
    const { onChange, user } = setup({ value: 1 });
    const input = screen.getByLabelText('Quantity');

    await user.type(input, '7');

    expect(onChange).toHaveBeenLastCalledWith(7);
    expect(input).toHaveValue(7);
  });

  it('clamps a typed value above the maximum', async () => {
    const { onChange, user } = setup({ value: 1, max: 10 });

    await user.type(screen.getByLabelText('Quantity'), '99');

    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it('ignores an emptied field rather than emitting NaN', async () => {
    const { onChange, user } = setup({ value: 2 });

    await user.clear(screen.getByLabelText('Quantity'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables every control when disabled', () => {
    setup({ value: 2, disabled: true });
    expect(screen.getByLabelText('Quantity')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
  });

  it('applies the small size modifier', () => {
    const { container } = setup({ value: 2, size: 'sm' });
    expect(container.querySelector('div')?.className).toContain('sm');
  });
});
