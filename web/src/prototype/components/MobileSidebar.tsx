'use client';

import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';

export const MobileSidebar: React.FC = () => {
    const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const handleResize = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    mediaQuery.addEventListener('change', handleResize);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      mediaQuery.removeEventListener('change', handleResize);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="fixed left-3 top-[88px] z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface shadow-lg lg:hidden"
        aria-label={open ? 'Close sidebar' : 'Open sidebar'}
        aria-expanded={open}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

        {/* Overlay */}
        {open && (
        <div
            className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
        />
        )}

        {/* Drawer - phủ cả Header */}
        <div
        className={`fixed inset-0 left-0 z-[70] h-dvh w-[min(85vw,320px)] bg-surface transition-transform duration-300 ease-in-out lg:hidden ${
            open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!open}
        >
        <Sidebar
            mobile
            onClose={() => setOpen(false)}
        />
        </div>
    </>
  );
};