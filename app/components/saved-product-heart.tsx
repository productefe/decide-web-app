"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { SaveProductInput } from "@/lib/saved-products";

type Props = {
  userId: string;
  product: SaveProductInput;
  className?: string;
};

const BURST_ANGLES = [0, 60, 120, 180, 240, 300];

export function SavedProductHeart({ userId, product, className = "" }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [justLiked, setJustLiked] = useState(false);

  const link = product.link?.trim() || "";

  useEffect(() => {
    if (!link) return;
    const supabase = createClient();
    supabase
      .from("saved_products")
      .select("id")
      .eq("user_id", userId)
      .eq("link", link)
      .maybeSingle()
      .then(({ data }) => setSaved(Boolean(data)));
  }, [userId, link]);

  useEffect(() => {
    if (!justLiked) return;
    const t = window.setTimeout(() => setJustLiked(false), 700);
    return () => clearTimeout(t);
  }, [justLiked]);

  const toggle = useCallback(async () => {
    if (!link || busy) return;
    setBusy(true);
    setError(false);
    const supabase = createClient();

    if (saved) {
      const { error: dbError } = await supabase
        .from("saved_products")
        .delete()
        .eq("user_id", userId)
        .eq("link", link);
      if (dbError) setError(true);
      else {
        setSaved(false);
        window.dispatchEvent(new CustomEvent("decide:saved-product-changed"));
        router.refresh();
      }
    } else {
      const { data, error: dbError } = await supabase
        .from("saved_products")
        .insert({
          user_id: userId,
          title: product.title,
          price: product.price,
          source: product.source,
          image: product.image,
          link,
          store: product.store || null,
          piece_label: product.piece_label || null,
          slot: product.slot || null,
          price_value: product.price_value ?? null,
          product_id: product.product_id ?? null,
          serpapi_product_api: product.serpapi_immersive_product_api ?? null,
        })
        .select("id")
        .single();

      if (dbError || !data) setError(true);
      else {
        setSaved(true);
        setJustLiked(true);
        window.dispatchEvent(new CustomEvent("decide:saved-product-changed"));
        router.refresh();
      }
    }

    setBusy(false);
  }, [userId, product, link, saved, busy, router]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void toggle();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={saved ? "Beğeniden kaldır" : "Beğen"}
      aria-pressed={saved}
      aria-busy={busy}
      className={`relative z-20 flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors touch-manipulation cursor-pointer ${
        error
          ? "border-destructive/50 text-destructive bg-destructive/10"
          : saved
            ? "bg-red-100 border-red-700 text-red-700"
            : "bg-card border-border text-muted-foreground hover:border-red-400 hover:text-red-600"
      } ${justLiked ? "animate-heart-pop" : "active:scale-95"} ${busy ? "opacity-70" : ""} ${className}`}
    >
      {justLiked && (
        <>
          <span className="absolute inset-0 rounded-xl border-2 border-red-700 animate-heart-ring pointer-events-none" aria-hidden />
          {BURST_ANGLES.map((deg) => (
            <span
              key={deg}
              className="absolute inset-0 flex items-start justify-center pt-0.5 pointer-events-none"
              style={{ transform: `rotate(${deg}deg)` }}
              aria-hidden
            >
              <span className="size-1.5 rounded-full bg-red-700 animate-heart-burst" />
            </span>
          ))}
        </>
      )}
      <Heart
        className={`size-4 pointer-events-none transition-all duration-300 ${
          saved ? "fill-current scale-110" : ""
        } ${justLiked ? "animate-heart-icon" : ""}`}
        aria-hidden
      />
    </button>
  );
}
