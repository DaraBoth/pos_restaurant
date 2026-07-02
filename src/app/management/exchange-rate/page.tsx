'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The exchange-rate editor now lives in the properly-shelled settings route
// (/settings/business/exchange-rate), reachable by all roles. This legacy
// route redirects there so no one lands on a chrome-less orphaned page.
export default function ExchangeRateRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/settings/business/exchange-rate');
    }, [router]);
    return null;
}
