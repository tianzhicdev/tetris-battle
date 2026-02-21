import type { ReactNode, HTMLAttributes } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'info' | 'success' | 'warning' | 'error' | 'neutral';
  children: ReactNode;
}

export function Badge({
  variant = 'neutral',
  children,
  className,
  ...rest
}: BadgeProps) {
  const classNames = [styles[variant], className].filter(Boolean).join(' ');

  return (
    <span className={classNames} {...rest}>
      {children}
    </span>
  );
}
