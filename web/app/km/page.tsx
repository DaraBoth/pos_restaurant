import type { Metadata } from 'next';
import LandingPage from '../_components/LandingPage';
import { KM } from '../_content/km';
import { fetchLatestRelease } from '../_lib/release';

export const metadata: Metadata = {
    title: 'DineOS — ប្រព័ន្ធ POS ទំនើបសម្រាប់ភោជនីយដ្ឋានកម្ពុជា',
    description:
        'ប្រព័ន្ធ POS ដែលដំណើរការដោយគ្មានអ៊ីនធើណិតសម្រាប់ភោជនីយដ្ឋាន និងហាងកាហ្វេ។ គាំទ្រដុល្លារ និងរៀល មានពាក្យខ្មែរ បោះពុម្ពបង្កាន់ដៃ និងបម្រុងទុក Cloud ដោយស្វ័យប្រវត្តិ។',
    openGraph: {
        title: 'DineOS — ប្រព័ន្ធ POS ទំនើបសម្រាប់កម្ពុជា',
        description: 'POS ដែលដំណើរការដោយគ្មានអ៊ីនធើណិត។ ដុល្លារ + រៀល មានពាក្យខ្មែរ បោះពុម្ពបង្កាន់ដៃ thermal។',
        locale: 'km_KH',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'DineOS — ប្រព័ន្ធ POS ទំនើបសម្រាប់កម្ពុជា',
        description: 'POS ដែលដំណើរការដោយគ្មានអ៊ីនធើណិត។ ដុល្លារ + រៀល មានពាក្យខ្មែរ បោះពុម្ពបង្កាន់ដៃ thermal។',
    },
    alternates: {
        languages: {
            en: '/',
            km: '/km',
        },
    },
};

export default async function Page() {
    const release = await fetchLatestRelease();
    return <LandingPage content={KM} initialRelease={release} />;
}
