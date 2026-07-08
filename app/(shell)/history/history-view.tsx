/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ExternalLink, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cleanStoreName } from "@/components/analyze/types";
import {
  formatHistoryDate,
  getHistoryPieces,
  SLOT_LABELS,
  type SearchHistoryRow,
} from "@/lib/search-history";

function HistoryPieceBlock({
  label,
  results,
}: {
  label: string;
  results: ReturnType<typeof getHistoryPieces>[0]["results"];
}) {
  const slots = [
    { key: "recommended" as const, product: results.recommended },
    { key: "cheaper" as const, product: results.cheaper },
    { key: "style" as const, product: results.style },
  ].filter((s) => s.product);

  if (slots.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      {slots.map(({ key, product }) =>
        product ? (
          <div key={key} className="flex gap-3 items-start pl-2 border-l-2 border-secondary/20">
            {product.image && (
              <img
                src={product.image}
                alt=""
                className="size-12 rounded-lg object-cover border border-border shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-secondary">
                {SLOT_LABELS[key]}
              </span>
              <p className="text-sm text-foreground line-clamp-2 leading-snug mt-0.5">
                {product.title}
              </p>
              <p className="text-sm font-semibold text-secondary mt-1">{product.price}</p>
              {product.link && (
                <a href={product.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
                  <Button variant="outline" size="full" className="h-9 text-xs gap-1.5 px-3">
                    {cleanStoreName(product.source)}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </Button>
                </a>
              )}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

export default function HistoryPage({
  items,
}: {
  items: SearchHistoryRow[];
}) {
  if (items.length === 0) {
    return (
      <section aria-label="Geçmiş aramalar" className="flex flex-col items-center text-center py-12 px-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary mb-4">
          <History className="size-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold text-foreground">Geçmiş aramalar</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs">
          Henüz arama yapmadın. Yükle sekmesinden ilk aramanı başlat.
        </p>
        <Link href="/workspace" className="mt-6 w-full max-w-xs">
          <Button size="full">Yükle!</Button>
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="Geçmiş aramalar">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">Arşivin</p>
        <h1 className="text-3xl font-semibold text-foreground mt-1">Geçmiş aramalar</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {items.length} arama kaydı
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((item) => {
          const pieces = getHistoryPieces(item.results);
          const isOutfit = pieces.length > 1;

          return (
            <article
              key={item.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex gap-3 pb-4 border-b border-border">
                {item.photo_url && (
                  <img
                    src={item.photo_url}
                    alt="Aradığın fotoğraf"
                    className="size-16 rounded-xl object-cover border border-border shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-secondary">
                    {isOutfit ? `Kombin · ${pieces.length} parça` : "Aradığın"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatHistoryDate(item.created_at)}
                  </p>
                </div>
              </div>

              {pieces.length > 0 ? (
                <div className="pt-4 flex flex-col gap-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Önerilenler
                  </p>
                  {pieces.map((piece, i) => (
                    <HistoryPieceBlock
                      key={`${piece.label}-${i}`}
                      label={piece.label}
                      results={piece.results}
                    />
                  ))}
                </div>
              ) : (
                <p className="pt-4 text-sm text-muted-foreground">Sonuç kaydı bulunamadı.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
