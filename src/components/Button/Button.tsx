import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

/**
 * - `primary`: navy fill, white text (main action on white screens).
 * - `accent`: lime fill, dark text and border (start actions: New game, Start game).
 * - `secondary`: navy outline on white.
 * - `onDark`: light outline on the dark home background.
 * - `ghost`: no border.
 */
export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'onDark' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Stretch the button to the width of its container. */
  fullWidth?: boolean;
}

/** Reusable `<button>` with the app styles (min height 48 px, visible focus ring). */
export function Button({
  variant = 'primary',
  fullWidth = false,
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], fullWidth ? styles.fullWidth : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
