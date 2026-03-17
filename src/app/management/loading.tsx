export default function ManagementLoading() {
    return (
        <div className="max-w-7xl mx-auto animate-fade-in space-y-6">
            <div className="h-28 rounded-[2rem] bg-[#181a20] border border-white/5 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-48 rounded-[2rem] bg-[#181a20] border border-white/5 animate-pulse" />
                ))}
            </div>
        </div>
    );
}
