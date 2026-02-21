import type { ReactNode, HTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'highlighted' | 'equipped' | 'danger';
  padding?: 'none' | 'default' | 'large';
  clickable?: boolean;
  animated?: boolean;
  children: ReactNode;
}

export function Card({
  variant = 'default',
  padding = 'default',
  clickable = false,
  animated = false,
  children,
  className,
  ...rest
}: CardProps) {
  const classNames = [
    styles[variant],
    padding === 'default' && styles.padded,
    padding === 'large' && styles.paddedLg,
    padding === 'none' && styles.noPadding,
    clickable && styles.clickable,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (animated) {
    const { onClick, ...htmlProps } = rest;
    return (
      <motion.div
        className={classNames}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onClick={onClick}
        {...(htmlProps as any)}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={classNames} {...rest}>
      {children}
    </div>
  );
}
