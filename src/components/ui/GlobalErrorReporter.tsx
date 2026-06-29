"use client";

import { useEffect } from 'react';
import { reportError } from '@/lib/error-reporter';

export default function GlobalErrorReporter() {
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            const detail = `${event.message}\nat ${event.filename}:${event.lineno}:${event.colno}`;
            reportError('window:error', detail).catch(() => {});
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            const msg = event.reason instanceof Error
                ? (event.reason.stack ?? event.reason.message)
                : String(event.reason);
            reportError('window:unhandledrejection', msg).catch(() => {});
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);
        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    return null;
}
