import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import styles from './Button.module.css';
import { buttonVariants } from '../../../utils/animations';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  animated?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  animated = true,
  children,
  className,
  ...rest
}: ButtonProps) {
  const classNames = [
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (animated) {
    const { onClick, disabled, type, ...htmlProps } = rest;
    return (
      <motion.button
        className={classNames}
        variants={buttonVariants}
        initial="idle"
        whileHover="hover"
        whileTap="tap"
        onClick={onClick}
        disabled={disabled}
        type={type}
        {...(htmlProps as any)}
      >
        {children}
      </motion.button>
    );
  }

  return (
    <button className={classNames} {...rest}>
      {children}
    </button>
  );
}
