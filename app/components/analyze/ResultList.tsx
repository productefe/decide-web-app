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
    { key: "style" as const, product: results.style },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <p className="text-xs tracking-[0.15em] uppercase text-muted-foreground">
          Sonuçlar
        </p>
        {preview && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Aradığın ürün</span>
            <img src={preview} alt="aradığın ürün" className="w-12 h-12 object-cover rounded-md border border-border" />
          </div>
        )}
      </div>

      <div className="flex flex-col">
        {slots.filter((s) => s.product).map(({ key, product }, index) =>
          product && (
            <div
              key={key}
              className={`flex flex-col sm:flex-row gap-4 py-6 ${
                index > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="flex sm:flex-[2] justify-center sm:justify-start">
                {product.image && (
                  <img src={product.image} alt={product.title} width={140} height={140} className="object-cover rounded-md border border-border" />
                )}
              </div>
              <div className="flex sm:flex-[3] flex-col justify-center gap-1">
                <p className="text-sm tracking-[0.12em] uppercase text-secondary font-bold">
                  {SLOT_LABELS[key]}
                </p>
                <p className="text-sm leading-relaxed">{product.reason}</p>
              </div>
              <div className="flex sm:flex-[1] flex-row sm:flex-col justify-between sm:justify-center items-center gap-2">
                <p className="font-bold text-secondary">{product.price}</p>
                <a href={product.link} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm">{cleanStoreName(product.source)}</Button>
                </a>
              </div>
            </div>
          )
        )}

        <div className="flex justify-between pt-6 border-t border-border">
          <Button variant="outline" onClick={close}>Kapat</Button>
          <Button variant="default" onClick={analyzeAnother}>Yeni Analiz</Button>
        </div>
      </div>
    </div>
  );
}
