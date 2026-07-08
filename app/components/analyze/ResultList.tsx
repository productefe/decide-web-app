/* eslint-disable @next/next/no-img-element */
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Results, SLOT_LABELS, cleanStoreName } from "./types";

function ReasonText({
  reason,
  loading,
}: {
  reason: string;
  loading: boolean;
}) {
  if (loading && !reason) {
    return (
      <div className="min-h-[2.75rem] flex flex-col justify-center gap-2" aria-hidden>
        <div className="h-3.5 bg-muted rounded-md animate-pulse w-full" />
        <div className="h-3.5 bg-muted rounded-md animate-pulse w-[85%]" />
      </div>
    );
  }

  return (
    <p className="min-h-[2.75rem] text-sm leading-relaxed text-foreground">
      {reason || "\u00A0"}
    </p>
  );
}

export function ResultList({
  results,
  preview,
  reasonsLoading,
  close,
  analyzeAnother,
}: {
  results: Results;
  preview: string | null;
  reasonsLoading?: boolean;
  close: () => void;
  analyzeAnother: () => void;
}) {
  const slots = [
    { key: "recommended" as const, product: results.recommended },
    { key: "cheaper" as const, product: results.cheaper },
    { key: "style" as const, product: results.style },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Sonuçların</p>
          <p className="text-xs text-muted-foreground mt-0.5">3 alternatif hazır</p>
        </div>
        {preview && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">Aradığın</span>
            <img src={preview} alt="Aradığın ürün" className="size-12 object-cover rounded-xl border border-border shadow-sm" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {slots.filter((s) => s.product).map(({ key, product }, i) =>
          product && (
            <article
              key={key}
              className={`rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${
                i === 0
                  ? "border-secondary/35 bg-gradient-to-br from-card to-secondary/5"
                  : i === 2
                    ? "border-accent/25 bg-gradient-to-br from-card to-accent/5"
                    : "border-border bg-muted/30"
              }`}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {product.image && (
                  <img
                    src={product.image}
                    alt={product.title}
                    width={120}
                    height={120}
                    className="mx-auto sm:mx-0 size-28 sm:size-[7.5rem] object-cover rounded-xl border border-border shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <span className="inline-flex w-fit rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                    {SLOT_LABELS[key]}
                  </span>
                  <ReasonText reason={product.reason} loading={!!reasonsLoading} />
                  <p className="text-xl font-semibold text-secondary">{product.price}</p>
                  <a href={product.link} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                    <Button variant="default" size="full" className="sm:w-auto sm:min-w-[140px] gap-2">
                      {cleanStoreName(product.source)}
                      <ExternalLink className="size-4" aria-hidden />
                    </Button>
                  </a>
                </div>
              </div>
            </article>
          )
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-6 mt-2 border-t border-border">
        <Button variant="outline" onClick={close} className="min-h-[44px]">Kapat</Button>
        <Button variant="default" onClick={analyzeAnother} className="min-h-[44px]">Yeni analiz</Button>
      </div>
    </div>
  );
}
