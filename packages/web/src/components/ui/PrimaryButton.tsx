import type { ReactNode } from 'react';
import { Button } from '../primitives';

interface PrimaryButtonProps {
  children: ReactNode;
  color?: string;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * @deprecated Use <Button variant="primary"> from primitives instead.
 * This component is kept for backward compatibility.
 */
export function PrimaryButton({
  children,
  onClick,
  disabled,
}: PrimaryButtonProps) {
  return (
    <Button
      variant="primary"
      size="md"
      fullWidth
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
