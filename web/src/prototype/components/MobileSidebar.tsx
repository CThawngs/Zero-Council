'use client';

import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  open,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Workspace Drawer */}
      <div
        id="mobile-navigation"
        className="fixed inset-y-0 left-0 z-[70] h-dvh w-[min(85vw,320px)] overflow-y-auto bg-surface lg:hidden"
      >
        <Sidebar mobile onClose={onClose} />
      </div>
    </>
  );
};