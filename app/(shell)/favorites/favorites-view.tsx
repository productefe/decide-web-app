/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { cleanStoreName } from "@/components/analyze/types";
import { formatSavedDate, type SavedProductRow } from "@/lib/saved-products";

export default function FavoritesView({
  userId,
  initialItems,
}: {
  userId: string;
  initialItems: SavedProductRow[];
}) {
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const refreshItems = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("saved_products")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as SavedProductRow[]);
  }, [userId]);

  useEffect(() => {
    const onChange = () => void refreshItems();
    window.addEventListener("decide:saved-product-changed", onChange);
    return () => window.removeEventListener("decide:saved-product-changed", onChange);
  }, [refreshItems]);

  async function remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("saved_products")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (!error) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  }

  if (items.length === 0) {
    return (
      <section aria-label="Beğendiklerin" className="flex flex-col items-center text-center py-12 px-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary mb-4">
          <Heart className="size-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold text-foreground">Beğendiklerin</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs">
          Henüz beğendiğin ürün yok. Analiz sonuçlarındaki kalbe tıklayarak kaydedebilirsin.
        </p>
        <Link href="/workspace" className="mt-6 w-full max-w-xs">
          <Button size="full">Yükle!</Button>
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="Beğendiklerin">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground">Beğendiklerin</h1>
        <p className="text-sm text-muted-foreground mt-2">{items.length} ürün</p>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex gap-3">
              {item.image && (
                <img
                  src={item.image}
                  alt={item.title}
                  className="size-20 rounded-xl object-cover border border-border shrink-0"
                />
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {item.piece_label && (
                      <p className="text-[11px] font-medium text-muted-foreground">{item.piece_label}</p>
                    )}
                    <p className="text-sm text-foreground line-clamp-2 leading-snug">{item.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    aria-label="Beğeniden kaldır"
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-red-100 border-red-700 text-red-700"
                  >
                    <Heart className="size-4 fill-current" aria-hidden />
                  </button>
                </div>
                <p className="text-lg font-semibold text-secondary">{item.price}</p>
                <p className="text-xs text-muted-foreground">{formatSavedDate(item.created_at)}</p>
                {item.link && (
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-1">
                    <Button variant="default" size="full" className="sm:w-auto sm:min-w-[140px] gap-2 min-h-[44px]">
                      {cleanStoreName(item.source)}
                      <ExternalLink className="size-4" aria-hidden />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
