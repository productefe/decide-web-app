/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SavedProductHeart } from "@/components/saved-product-heart";
import { GuestHeartUpsell } from "@/components/guest-heart-upsell";
import { Results, SLOT_LABELS, cleanStoreName, type PieceResult, type Product } from "./types";

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

function ProductCard({
  slotKey,
  product,
  pieceLabel,
  userId,
  guestMode,
  onSignup,
  reasonsLoading,
  highlight,
}: {
  slotKey: "recommended" | "cheaper" | "style";
  product: Product;
  pieceLabel?: string;
  userId: string;
  guestMode?: boolean;
  onSignup?: () => void;
  reasonsLoading?: boolean;
  highlight: "primary" | "default" | "accent";
}) {
  const cardClass =
    highlight === "primary"
      ? "border-secondary/35 bg-gradient-to-br from-card to-secondary/5"
      : highlight === "accent"
        ? "border-accent/25 bg-gradient-to-br from-card to-accent/5"
        : "border-border bg-muted/30";

  return (
    <article
      className={`relative rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${cardClass}`}
      onClick={(e) => e.stopPropagation()}
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
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex w-fit rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-semibold text-secondary">
              {SLOT_LABELS[slotKey]}
            </span>
            {guestMode && onSignup ? (
              <GuestHeartUpsell onSignup={onSignup} />
            ) : (
              <SavedProductHeart
                userId={userId}
                product={{
                  title: product.title,
                  price: product.price,
                  source: product.source,
                  image: product.image,
                  link: product.link,
                  store: product.store,
                  piece_label: pieceLabel,
                  slot: slotKey,
                }}
              />
            )}
          </div>
          <ReasonText reason={product.reason} loading={!!reasonsLoading} />
          <p className="text-xl font-semibold text-secondary">{product.price}</p>
          {product.link ? (
            <a href={product.link} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button variant="default" size="full" className="sm:w-auto sm:min-w-[140px] gap-2">
                {cleanStoreName(product.source)}
                <ExternalLink className="size-4" aria-hidden />
              </Button>
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function PieceProductCards({
  results,
  pieceLabel,
  userId,
  guestMode,
  onSignup,
  reasonsLoading,
}: {
  results: Results;
  pieceLabel?: string;
  userId: string;
  guestMode?: boolean;
  onSignup?: () => void;
  reasonsLoading?: boolean;
}) {
  const slots: Array<{
    key: "recommended" | "cheaper" | "style";
    product: Product | null;
    highlight: "primary" | "default" | "accent";
  }> = [
    { key: "recommended", product: results.recommended, highlight: "primary" },
    { key: "cheaper", product: results.cheaper, highlight: "default" },
    { key: "style", product: results.style, highlight: "accent" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {slots
        .filter((s) => s.product)
        .map(({ key, product, highlight }) =>
          product ? (
            <ProductCard
              key={key}
              slotKey={key}
              product={product}
              pieceLabel={pieceLabel}
              userId={userId}
              guestMode={guestMode}
              onSignup={onSignup}
              reasonsLoading={reasonsLoading}
              highlight={highlight}
            />
          ) : null
        )}
    </div>
  );
}

export function ResultList({
  pieces,
  preview,
  userId,
  guestMode = false,
  onSignup,
  reasonsLoading,
  close,
  analyzeAnother,
}: {
  pieces: PieceResult[];
  preview: string | null;
  userId: string;
  guestMode?: boolean;
  onSignup?: () => void;
  reasonsLoading?: boolean;
  close: () => void;
  analyzeAnother: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isMulti = pieces.length > 1;

  useEffect(() => {
    setActiveIndex(0);
  }, [pieces]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isMulti) return;

    const onScroll = () => {
      const slideWidth = el.clientWidth;
      if (slideWidth <= 0) return;
      const index = Math.round(el.scrollLeft / slideWidth);
      setActiveIndex(Math.min(index, pieces.length - 1));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isMulti, pieces.length]);

  const activePiece = pieces[activeIndex];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Sonuçların</p>
          {isMulti ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {activePiece.label} · {activeIndex + 1}/{pieces.length} — kaydır
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">3 alternatif hazır</p>
          )}
        </div>
        {preview && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">Aradığın</span>
            <img src={preview} alt="Aradığın fotoğraf" className="size-12 object-cover rounded-xl border border-border shadow-sm" />
          </div>
        )}
      </div>

      {isMulti && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
          {pieces.map((piece, i) => (
            <button
              key={`${piece.label}-${i}`}
              type="button"
              onClick={() => {
                const el = scrollRef.current;
                if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
                setActiveIndex(i);
              }}
              className={`shrink-0 min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                i === activeIndex
                  ? "bg-secondary text-secondary-foreground border-secondary"
                  : "bg-muted text-foreground border-border hover:border-secondary/40"
              }`}
            >
              {piece.label}
            </button>
          ))}
        </div>
      )}

      {isMulti ? (
        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-6 px-6 gap-4 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {pieces.map((piece, i) => (
            <div key={`${piece.label}-${i}`} className="w-full shrink-0 snap-center animate-fade-in">
              <PieceProductCards
                results={piece.results}
                pieceLabel={piece.label}
                userId={userId}
                guestMode={guestMode}
                onSignup={onSignup}
                reasonsLoading={reasonsLoading}
              />
            </div>
          ))}
        </div>
      ) : (
        <PieceProductCards
          results={pieces[0].results}
          pieceLabel={pieces[0].label}
          userId={userId}
          guestMode={guestMode}
          onSignup={onSignup}
          reasonsLoading={reasonsLoading}
        />
      )}

      {isMulti && (
        <div className="flex justify-center gap-1.5 mt-4" aria-hidden>
          {pieces.map((_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-colors ${
                i === activeIndex ? "bg-secondary" : "bg-border"
              }`}
            />
          ))}
        </div>
      )}

      {guestMode && onSignup && (
        <div className="mt-6 rounded-xl border border-secondary/25 bg-secondary/5 p-4 text-center">
          <p className="text-sm text-foreground leading-relaxed">
            Bunu hesabınıza kaydetmek için şu an üye olun.
          </p>
          <Button variant="default" size="full" className="mt-3 min-h-[44px]" onClick={onSignup}>
            Kayıt ol
          </Button>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-6 mt-2 border-t border-border">
        <Button variant="outline" onClick={close} className="min-h-[44px]">Kapat</Button>
        {!guestMode && (
          <Button variant="default" onClick={analyzeAnother} className="min-h-[44px]">Yeni analiz</Button>
        )}
      </div>
    </div>
  );
}
