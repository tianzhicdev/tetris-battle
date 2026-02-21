import type { InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error = false, className, ...rest }: InputProps) {
  const classNames = [error ? styles.error : styles.input, className]
    .filter(Boolean)
    .join(' ');

  return <input className={classNames} {...rest} />;
}
