export default function ShellLoading() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor" className="animate-fade-in">
      <div className="h-9 w-44 bg-muted rounded-lg animate-pulse" />
      <div className="h-5 w-full max-w-xs bg-muted rounded-md animate-pulse mt-3" />
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
          <div className="size-9 rounded-xl bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 bg-muted rounded-md animate-pulse" />
            <div className="h-3 w-20 bg-muted rounded-md animate-pulse" />
          </div>
        </div>
        <div className="min-h-[13rem] rounded-2xl bg-muted animate-pulse" />
        <div className="h-12 w-full bg-muted rounded-xl animate-pulse mt-4" />
      </div>
    </div>
  );
}
