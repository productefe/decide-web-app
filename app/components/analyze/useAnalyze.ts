import { useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Stage, Results } from "./types";

export function useAnalyze(userId: string) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const start = async () => {
    if (!selectedFile || stage === "loading") return;
    setOpen(true);
    setStage("loading");
    setError(null);

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
        body: JSON.stringify({ photo_url: publicUrl }),
      });

      if (!response.ok) throw new Error("Sunucuya ulaşılamadı, lütfen tekrar dene.");

      const data = await response.json();
      const item = Array.isArray(data) ? data[0] : data;

      if (item?.error) throw new Error(item.error);

      const res = item?.results;
      if (!res) throw new Error("Sonuç alınamadı, lütfen tekrar dene.");

      const parsed: Results = typeof res === "string" ? JSON.parse(res) : res;
      setResults(parsed);
      setStage("result");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu";
      setError(message);
      setStage("error");
    }
  };

  const close = () => {
    setOpen(false);
    setStage("idle");
    setResults(null);
    setError(null);
  };

  const analyzeAnother = () => {
    close();
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return {
    open, stage, preview, results, error, fileInputRef,
    selectedFile, handleFileChange, start, close, analyzeAnother,
  };
}