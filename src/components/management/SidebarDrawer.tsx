'use client';
import { useEffect, useState } from 'react';
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

  useOverlayBehavior(shouldRender, onClose);

  useEffect(() => {
    if (isOpen) setShouldRender(true);
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) setShouldRender(false);
  };

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className={`relative w-full max-w-lg bg-[#181a20] border-l border-white/10 shadow-2xl transition-transform duration-300 ease-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        onTransitionEnd={handleAnimationEnd}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#1e2229]/50 backdrop-blur-md">
            <div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              {subtitle && <p className="text-sm text-[var(--text-secondary)] font-medium mt-0.5">{subtitle}</p>}
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-[var(--text-secondary)] hover:text-white transition-all shadow-sm"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto container-snap p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
