export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center h-12 w-12">
          <div className="absolute animate-ping h-8 w-8 rounded-full bg-brand-orange/20" />
          <div className="h-8 w-8 rounded-full border-2 border-brand-orange border-t-transparent animate-spin" />
        </div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-sans animate-pulse">
          Loading Portal...
        </p>
      </div>
    </div>
  );
}

