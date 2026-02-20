import type { ReactNode } from 'react';
import { T } from '../../design-tokens';

interface LabelProps {
  children: ReactNode;
}

export function Label({ children }: LabelProps) {
  return (
    <div
      style={{
        fontSize: 9,
        color: T.text.tertiary,
        fontFamily: T.font.body,
        letterSpacing: 3,
        marginBottom: 6,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}
