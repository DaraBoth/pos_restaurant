'use client';

import { useRouter } from 'next/navigation';
import RestaurantSettingsForm from '@/components/management/RestaurantSettingsForm';

export default function SetupPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-[#0f1115] px-6 py-10">
            <RestaurantSettingsForm mode="setup" onNext={() => router.replace('/pos/tables')} />
        </div>
    );
}