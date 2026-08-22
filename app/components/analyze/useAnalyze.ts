"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Stage, Results, PieceResult } from "./types";
import { parseOccasion, type Occasion } from "@/lib/preferences";
import { OCCASION_TO_CONTEXT } from "@/lib/combine-rules";
import { markGuestAnalysisUsed, saveGuestResultsLocal } from "@/lib/guest";
import { sanitizeUploadFileName, validateImageFile } from "@/lib/upload";

export function useAnalyze(
  userId: string,
  options?: { guestMode?: boolean; onAnalysisComplete?: () => void }
) {
  const guestMode = options?.guestMode ?? false;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pieces, setPieces] = useState<PieceResult[] | null>(null);
  const [reasonsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      setStage("idle");
      setOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setError(null);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const openPhotoPicker = () => {
    fileInputRef.current?.click();
  };

  const start = async () => {
    if (!selectedFile || stage === "loading") return;

    const validationError = validateImageFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setStage("idle");
      setOpen(false);
      return;
    }

    setOpen(true);
    setStage("loading");
    setError(null);

    try {
      const supabase = createClient();
      const safeName = sanitizeUploadFileName(selectedFile.name);
      const fileName = `${userId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(fileName, selectedFile);

      if (uploadError) throw new Error("Fotoğraf yüklenemedi: " + uploadError.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from("product-photos").getPublicUrl(fileName);

      const response = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_url: publicUrl,
          storage_path: fileName,
          occasion: occasion || undefined,
          context: occasion ? OCCASION_TO_CONTEXT[occasion] : undefined,
        }),
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
        const res: Results =
          typeof item.results === "string" ? JSON.parse(item.results) : item.results;
        parsedPieces = [{ label: "Parça", category_tr: "", results: res }];
      }

      if (parsedPieces.length === 0) {
        throw new Error("Sonuç alınamadı, lütfen tekrar dene.");
      }

      const resolved = parseOccasion(item?.occasion) || parseOccasion(item?.context);
      if (resolved) setOccasion(resolved);

      setPieces(parsedPieces);
      setStage("result");
      if (guestMode) {
        markGuestAnalysisUsed();
        saveGuestResultsLocal({ photo_url: publicUrl, pieces: parsedPieces });
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu";
      setError(message);
      setStage("error");
    }
  };

  const close = () => {
    const completedGuestAnalysis =
      guestMode && stage === "result" && pieces !== null && pieces.length > 0;
    setOpen(false);
    setStage("idle");
    setPieces(null);
    setError(null);
    if (completedGuestAnalysis) {
      options?.onAnalysisComplete?.();
    }
  };

  const analyzeAnother = () => {
    close();
    setSelectedFile(null);
    setPreview(null);
    setOccasion(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return {
    open,
    stage,
    preview,
    pieces,
    reasonsLoading,
    error,
    fileInputRef,
    selectedFile,
    occasion,
    setOccasion,
    handleFileChange,
    openPhotoPicker,
    start,
    close,
    analyzeAnother,
  };
}
