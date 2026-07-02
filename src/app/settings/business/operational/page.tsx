'use client';

import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import RestaurantSettingsForm from '@/components/management/RestaurantSettingsForm';
import SettingsSection from '../../SettingsSection';

export default function BusinessOperationalPage() {
    const { user } = useAuth();
    const { t } = useLanguage();
    if (user?.role !== 'admin') return null;
    return (
        <SettingsSection title={t('settingsBizOperationsHeader')} description={t('settingsOperationalDesc')}>
            <RestaurantSettingsForm mode="manage" activeSection="operational" />
        </SettingsSection>
    );
}
