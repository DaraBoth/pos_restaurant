// Server component — no client JS cost. Just passes children through.
export default function POSLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
