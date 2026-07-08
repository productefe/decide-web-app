import { useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { pickProductPhoto } from "@/lib/pick-photo";
import { Stage, Results } from "./types";

function toExplainPayload(results: Results) {
  const pick = (p: Results["recommended"]) =>
    p ? { title: p.title, price: p.price, source: p.source } : null;
  return {
    recommended: pick(results.recommended),
    cheaper: pick(results.cheaper),
    style: pick(results.style),
  };
}

function applyReasons(results: Results, reasons: Record<string, string | undefined>): Results {
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

export function useAnalyze(userId: string) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [reasonsLoading, setReasonsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const explainAbortRef = useRef<AbortController | null>(null);

  const fetchReasons = async (parsed: Results) => {
    explainAbortRef.current?.abort();
    const controller = new AbortController();
    explainAbortRef.current = controller;

    setReasonsLoading(true);
    try {
      const response = await fetch("/api/decide/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toExplainPayload(parsed)),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || controller.signal.aborted) return;

      if (data.reasons) {
        setResults((prev) => (prev ? applyReasons(prev, data.reasons) : prev));
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

      const res = item?.results;
      if (!res) throw new Error("Sonuç alınamadı, lütfen tekrar dene.");

      const parsed: Results = typeof res === "string" ? JSON.parse(res) : res;
      setResults(parsed);
      setStage("result");
      void fetchReasons(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu";
      setError(message);
      setStage("error");
    }
  };

  const close = () => {
    explainAbortRef.current?.abort();
    setOpen(false);
    setStage("idle");
    setResults(null);
    setReasonsLoading(false);
    setError(null);
  };

  const analyzeAnother = () => {
    close();
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return {
    open, stage, preview, results, reasonsLoading, error, fileInputRef,
    selectedFile, handleFileChange, openPhotoPicker, start, close, analyzeAnother,
  };
}
