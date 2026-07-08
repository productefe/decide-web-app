export default function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="max-w-lg mx-auto flex items-center px-5 h-14">
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-secondary shrink-0" aria-hidden />
          <span className="font-semibold text-lg text-secondary tracking-tight">DECIDE</span>
        </span>
      </div>
    </header>
  );
}
