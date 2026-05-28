import LandingPage from './_components/LandingPage';
import { EN } from './_content/en';
import { fetchLatestRelease } from './_lib/release';

export default async function Page() {
    const release = await fetchLatestRelease();
    return <LandingPage content={EN} initialRelease={release} />;
}
