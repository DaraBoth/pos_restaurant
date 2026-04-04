'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useOverlayBehavior from '@/hooks/useOverlayBehavior';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function SidebarDrawer({ isOpen, onClose, title, subtitle, children }: SidebarDrawerProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [mounted, setMounted] = useState(false);

  useOverlayBehavior(shouldRender, onClose);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) setShouldRender(true);
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) setShouldRender(false);
  };

  if (!shouldRender || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex justify-end" aria-modal="true" role="dialog">
      {/* Backdrop — absolute since parent is already fixed inset-0 */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer — flex-col + h-full fills the full viewport height */}
      <div
        className={`relative flex flex-col w-full max-w-lg h-full bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        onTransitionEnd={handleAnimationEnd}
      >
        {/* Header — flex-shrink-0 keeps it fixed at top */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">{title}</h2>
            {subtitle && <p className="text-sm text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--bg-dark)] hover:bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content — flex-1 takes remaining space, scrolls independently */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

