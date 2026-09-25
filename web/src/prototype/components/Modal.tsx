'use client';

import { X } from 'lucide-react';
import {
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
} from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel = 'Close',
  className = '',
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      triggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const close = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    close();
  };

  const handleClose = () => {
    onClose();
    triggerRef.current?.focus();
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const isBackdrop =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (isBackdrop) close();
  };

  return (
    <dialog
      ref={dialogRef}
      className={`zc-modal ${className}`.trim()}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClose={handleClose}
      onClick={handleBackdropClick}
    >
      <div className="zc-modal__surface">
        <header className="zc-modal__header">
          <div className="zc-modal__heading">
            <h2 id={titleId} className="zc-modal__title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="zc-modal__description">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="zc-modal__close"
            onClick={close}
            aria-label={closeLabel}
          >
            <X aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
        </header>
        <div className="zc-modal__content">{children}</div>
        {footer ? <footer className="zc-modal__footer">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
