'use client';
import { useEffect, useState } from 'react';
import { getDbStatus } from '@/lib/tauri-commands';
import { Database, Cloud } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';

export default function OfflineIndicator() {
    const [isLocal, setIsLocal] = useState(true);
    const { t } = useLanguage();

    useEffect(() => {
        async function checkStatus() {
            try {
                const status = await getDbStatus();
                setIsLocal(status.mode === 'local');
            } catch {
                setIsLocal(true); // defaults to local fallback
            }
        }

        checkStatus();
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${isLocal ? 'status-local' : 'status-synced'}`}>
            {isLocal ? <Database size={14} /> : <Cloud size={14} />}
            <span>{isLocal ? t('localMode') : t('syncedMode')}</span>
        </div>
    );
}
