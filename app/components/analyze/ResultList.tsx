/* eslint-disable @next/next/no-img-element */
import { Button } from "@/components/ui/button";
import { Results, SLOT_LABELS, cleanStoreName } from "./types";

export function ResultList({
  results,
  preview,
  close,
  analyzeAnother,
}: {
  results: Results;
  preview: string | null;
  close: () => void;
  analyzeAnother: () => void;
}) {
  const slots = [
    { key: "recommended" as const, product: results.recommended },
    { key: "cheaper" as const, product: results.cheaper },
    { key: "safer" as const, product: results.safer },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-secondary text-xs font-extrabold tracking-widest uppercase">
          Sonuçlar
        </p>
        {preview && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Aradığın ürün</span>
            <img src={preview} alt="aradığın ürün" className="w-12 h-12 object-cover rounded-lg border border-border" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-10">
        {slots.filter((s) => s.product).map(({ key, product }) =>
          product && (
            <div key={key} className="flex flex-col sm:flex-row gap-4 sm:gap-2 sm:justify-center">
              <div className="flex sm:flex-[2] justify-center">
                {product.image && (
                  <img src={product.image} alt={product.title} width={160} height={160} className="object-cover rounded-xl" />
                )}
              </div>
              <div className="flex sm:flex-[3] flex-col justify-center">
                <p className="text-xl text-secondary font-extrabold uppercase">{SLOT_LABELS[key]}</p>
                <p className="text-sm">{product.reason}</p>
              </div>
              <div className="flex sm:flex-[1] flex-row sm:flex-col justify-between sm:justify-center items-center gap-2">
                <p className="font-semibold">{product.price}</p>
                <a href={product.link} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary">{cleanStoreName(product.source)}</Button>
                </a>
              </div>
            </div>
          )
        )}

        <div className="flex justify-between">
          <Button variant="destructive" onClick={close}>Kapat</Button>
          <Button variant="default" onClick={analyzeAnother}>Yeni Analiz</Button>
        </div>
      </div>
    </div>
  );
}