import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Modal.module.css';

export interface ModalProps {
  /** Id of the element naming the dialog (its title). */
  labelledBy: string;
  /** Called on Escape or a tap on the backdrop. */
  onCancel: () => void;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog over a backdrop. On open, focus moves to the first element marked
 * `data-autofocus` (else the first focusable one) and stays trapped inside; Escape or a tap on
 * the backdrop cancels. Focus returns to the previously focused element when it closes. Make the
 * content behind it `inert` while it is open.
 */
export function Modal({ labelledBy, onCancel, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Read while rendering: by the time effects run, making the background inert has already
  // blurred the element that opened the dialog.
  const [previous] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const target =
      dialog?.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog?.querySelector<HTMLElement>(FOCUSABLE) ??
      dialog;
    target?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [previous]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={styles.backdrop} onClick={onCancel} data-testid="modal-backdrop">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={className ? `${styles.dialog} ${className}` : styles.dialog}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
