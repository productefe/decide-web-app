import { Upload } from "lucide-react";
import { ReactNode } from "react";

type Props = {
  badge?: ReactNode;
  title: ReactNode;
  description: string;
  notice?: ReactNode;
  children: ReactNode;
};

/** Full-height mobile layout: header top, upload card pinned above tab bar. */
export function UploadScreenLayout({ badge, title, description, notice, children }: Props) {
  return (
    <section
      aria-label="Karar alanı"
      className="flex h-full min-h-0 flex-col overflow-hidden animate-fade-in-up"
    >
      <header className="shrink-0">
        {badge}
        {title}
        <p className="mt-2 text-sm leading-snug text-muted-foreground sm:text-base">{description}</p>
        {notice ? <div className="mt-3">{notice}</div> : null}
      </header>

      <div className="mt-auto shrink-0 pt-4">
        <div className="rounded-2xl border border-secondary/20 bg-card/95 p-4 shadow-sm ring-1 ring-secondary/10 sm:p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <Upload className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Fotoğraf yükle</p>
              <p className="text-xs text-muted-foreground">Tek fotoğraf yeter</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
