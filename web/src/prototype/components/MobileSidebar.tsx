'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sidebar } from './Sidebar';

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  open,
  onClose,
}) => {
  const { t } = useApp();
  const [entered, setEntered] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Next frame: flip to the open position so the drawer slides in.
    const frame = requestAnimationFrame(() => setEntered(true));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      setEntered(false);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-200 lg:hidden ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Workspace Drawer */}
      <div
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-label={t.workspaceNavigation}
        className={`fixed inset-y-0 left-0 z-[70] h-dvh w-[min(85vw,320px)] overflow-y-auto border-r border-border bg-surface shadow-2xl transition-transform duration-200 ease-out lg:hidden ${
          entered ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar mobile onClose={onClose} />
      </div>
    </>
  );
};
