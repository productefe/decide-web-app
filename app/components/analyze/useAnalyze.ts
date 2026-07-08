"use client";

import { useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { pickProductPhoto } from "@/lib/pick-photo";
import { Stage, Results, PieceResult } from "./types";

type ExplainReasons = {
  recommended_reason?: string;
  cheaper_reason?: string;
  style_reason?: string;
};

function toExplainPayload(results: Results) {
  const pick = (p: Results["recommended"]) =>
    p ? { title: p.title, price: p.price, source: p.source } : null;
  return {
    recommended: pick(results.recommended),
    cheaper: pick(results.cheaper),
    style: pick(results.style),
  };
}

function applyReasons(results: Results, reasons: Partial<ExplainReasons>): Results {
  return {
    recommended: results.recommended
      ? { ...results.recommended, reason: reasons.recommended_reason || results.recommended.reason }
      : null,
    cheaper: results.cheaper
      ? { ...results.cheaper, reason: reasons.cheaper_reason || results.cheaper.reason }
      : null,
    style: results.style
      ? { ...results.style, reason: reasons.style_reason || results.style.reason }
      : null,
  };
}

import { markGuestAnalysisUsed, saveGuestResultsLocal } from "@/lib/guest";

export function useAnalyze(
  userId: string,
  options?: { guestMode?: boolean; onAnalysisComplete?: () => void }
) {
  const guestMode = options?.guestMode ?? false;
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pieces, setPieces] = useState<PieceResult[] | null>(null);
  const [reasonsLoading, setReasonsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const explainAbortRef = useRef<AbortController | null>(null);

  const fetchReasons = async (parsedPieces: PieceResult[], photoUrl?: string) => {
    explainAbortRef.current?.abort();
    const controller = new AbortController();
    explainAbortRef.current = controller;

    setReasonsLoading(true);
    try {
      const body =
        parsedPieces.length > 1
          ? {
              pieces: parsedPieces.map((p) => ({
                label: p.label,
                ...toExplainPayload(p.results),
              })),
            }
          : toExplainPayload(parsedPieces[0].results);

      const response = await fetch("/api/decide/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || controller.signal.aborted) return;

      let updatedPieces = parsedPieces;
      if (parsedPieces.length > 1 && Array.isArray(data.pieces)) {
        updatedPieces = parsedPieces.map((piece, i) => ({
          ...piece,
          results: applyReasons(piece.results, data.pieces[i] || {}),
        }));
        setPieces(updatedPieces);
      } else if (data.reasons) {
        updatedPieces = [
          { ...parsedPieces[0], results: applyReasons(parsedPieces[0].results, data.reasons) },
          ...parsedPieces.slice(1),
        ];
        setPieces(updatedPieces);
      }
      if (guestMode && photoUrl) {
        saveGuestResultsLocal({ photo_url: photoUrl, pieces: updatedPieces });
      }
    } catch {
      // Açıklama gelmezse ürünler yine görünür
    } finally {
      if (!controller.signal.aborted) {
        setReasonsLoading(false);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const openPhotoPicker = async () => {
    const native = await pickProductPhoto();
    if (native) {
      setSelectedFile(native.file);
      setPreview(native.preview);
      return;
    }
    fileInputRef.current?.click();
  };

  const start = async () => {
    if (!selectedFile || stage === "loading") return;
    setOpen(true);
    setStage("loading");
    setError(null);
    setReasonsLoading(false);
    explainAbortRef.current?.abort();

    try {
      const supabase = createClient();
      const fileName = `${userId}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(fileName, selectedFile);

      if (uploadError) throw new Error("Fotoğraf yüklenemedi: " + uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from("product-photos")
        .getPublicUrl(fileName);

      const response = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_url: publicUrl, storage_path: fileName }),
      });

      const data = await response.json().catch(() => ({}));
      const item = Array.isArray(data) ? data[0] : data;

      if (!response.ok) {
        throw new Error(item?.error || "Sunucuya ulaşılamadı, lütfen tekrar dene.");
      }

      if (item?.error) throw new Error(item.error);

      let parsedPieces: PieceResult[] = [];
      if (Array.isArray(item?.pieces) && item.pieces.length > 0) {
        parsedPieces = item.pieces;
      } else if (item?.results) {
        const res: Results = typeof item.results === "string" ? JSON.parse(item.results) : item.results;
        parsedPieces = [{ label: "Parça", category_tr: "", results: res }];
      }

      if (parsedPieces.length === 0) {
        throw new Error("Sonuç alınamadı, lütfen tekrar dene.");
      }

      setPieces(parsedPieces);
      setStage("result");
      if (guestMode) {
        markGuestAnalysisUsed();
        saveGuestResultsLocal({ photo_url: publicUrl, pieces: parsedPieces });
      }
      void fetchReasons(parsedPieces, guestMode ? publicUrl : undefined);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu";
      setError(message);
      setStage("error");
    }
  };

  const close = () => {
    const completedGuestAnalysis =
      guestMode && stage === "result" && pieces !== null && pieces.length > 0;
    explainAbortRef.current?.abort();
    setOpen(false);
    setStage("idle");
    setPieces(null);
    setReasonsLoading(false);
    setError(null);
    if (completedGuestAnalysis) {
      options?.onAnalysisComplete?.();
    }
  };

  const analyzeAnother = () => {
    close();
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return {
    open, stage, preview, pieces, reasonsLoading, error, fileInputRef,
    selectedFile, handleFileChange, openPhotoPicker, start, close, analyzeAnother,
  };
}
