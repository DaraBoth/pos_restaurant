'use client';

import { useEffect } from 'react';

export default function useOverlayBehavior(enabled: boolean, onClose: () => void) {
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
            }
        }

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [enabled, onClose]);
}