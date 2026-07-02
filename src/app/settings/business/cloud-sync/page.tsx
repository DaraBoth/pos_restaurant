'use client';

import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { CloudResetDialog } from '@/components/management/CloudResetDialog';
import SettingsSection from '../../SettingsSection';

export default function BusinessCloudSyncPage() {
    const { user } = useAuth();
    const { t } = useLanguage();
    if (user?.role !== 'admin' || !user?.restaurant_id) return null;
    return (
        <SettingsSection title={t('settingsBizSyncHeader')} description={t('settingsCloudSyncDesc')}>
            <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">{t('settingsDangerZone')}</p>
                <CloudResetDialog restaurantId={user.restaurant_id} />
            </div>
        </SettingsSection>
    );
}
