'use client'
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

type Stage = "idle" | "loading" | "result" | "error";

interface Product {
  title: string;
  price: string;
  source: string;
  image: string;
  link: string;
  store: string;
  reason: string;
  label: string;
}

interface Results {
  recommended: Product | null;
  cheaper: Product | null;
  safer: Product | null;
}

const SLOT_LABELS: Record<string, string> = {
  recommended: "ÖNERİLEN",
  cheaper: "DAHA UYGUN",
  safer: "GÜVENLİ SEÇİM",
};

// "Amazon.com.tr - Amazon.com.tr – pazaryeri" gibi kaynakları temizler
function cleanStoreName(source: string): string {
  if (!source) return "Mağaza";
  const first = source.split(/[-–]/)[0].trim();
  return first.length > 20 ? first.slice(0, 20) + "…" : first;
}

export default function AnalyzeModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

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

      if (uploadError) {
        throw new Error("Fotoğraf yüklenemedi: " + uploadError.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from("product-photos")
        .getPublicUrl(fileName);

      const response = await fetch("https://emavia.app.n8n.cloud/webhook/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_url: publicUrl, user_id: userId }),
      });

      if (!response.ok) {
        throw new Error("Sunucuya ulaşılamadı, lütfen tekrar dene.");
      }

      const data = await response.json();
      const item = Array.isArray(data) ? data[0] : data;

      // Backend'in hata dalı: { error: "..." }
      if (item?.error) {
        throw new Error(item.error);
      }

      const res = item?.results;
      if (!res) throw new Error("Sonuç alınamadı, lütfen tekrar dene.");

      // String de gelse obje de gelse çalışır
      const parsed: Results = typeof res === "string" ? JSON.parse(res) : res;

      // NOT: search_history insert'i kaldırıldı — kayıt n8n tarafında atılıyor (çift kayıt bug'ı)

      setResults(parsed);
      setStage("result");

    } catch (err: any) {
      setError(err.message || "Bir hata oluştu");
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

  const slots: Array<{ key: keyof Results; product: Product | null }> = results
    ? [
        { key: "recommended", product: results.recommended },
        { key: "cheaper", product: results.cheaper },
        { key: "safer", product: results.safer },
      ]
    : [];

  return (
    <>
      <input
        ref={fileInputRef}
        className="file-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        hidden
      />

      <label className="upload-box" onClick={() => fileInputRef.current?.click()}>
        <span>Ürün fotoğrafını yükle</span>
        <small>JPG, PNG veya ekran görüntüsü</small>
        {preview && (
          <img src={preview} alt="önizleme" style={{ maxHeight: 200, marginTop: 8, borderRadius: 8 }} />
        )}
      </label>

      <Button
        onClick={start}
        disabled={!selectedFile || stage === "loading"}
        variant={"default"}
        size={"full"}
      >
        Analiz Et
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={stage !== "loading" ? close : undefined}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >

            {stage === "loading" && (
              <div className="loading-card">
                <div className="orb" />
                <h2>Analiz ediliyor</h2>
                <div className="steps">
                  <div className="step active">Ürün okunuyor</div>
                  <div className="step active">Mağazalar taranıyor</div>
                  <div className="step active">Alternatifler karşılaştırılıyor</div>
                  <div className="step">Sonuç hazırlanıyor</div>
                </div>
              </div>
            )}

            {stage === "error" && (
              <div className="result-card flex flex-col gap-4 items-start">
                <h2 className="text-xl font-bold">Sonuç bulunamadı</h2>
                <p className="text-sm text-zinc-400">{error}</p>
                <p className="text-sm text-zinc-400">
                  Ürünün net göründüğü, iyi aydınlatılmış bir fotoğrafla tekrar deneyebilirsin.
                </p>
                <Button variant={"default"} onClick={analyzeAnother}>Tekrar Dene</Button>
              </div>
            )}

            {stage === "result" && results && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <p className="eyebrow">Sonuçlar</p>
                  {preview && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Aradığın ürün</span>
                      <img
                        src={preview}
                        alt="aradığın ürün"
                        className="w-12 h-12 object-cover rounded-lg border border-zinc-700"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-10">
                  {slots.filter(s => s.product).map(({ key, product }) => product && (
                    <div key={key} className="flex flex-col sm:flex-row gap-4 sm:gap-2 sm:justify-center">
                      <div className="flex sm:flex-2 justify-center">
                        {product.image && (
                          <img
                            src={product.image}
                            alt={product.title}
                            width={160}
                            height={160}
                            style={{ objectFit: "cover", borderRadius: 8 }}
                          />
                        )}
                      </div>
                      <div className="flex sm:flex-3 flex-col justify-center">
                        <p className="text-xl text-(--secondary) font-extrabold uppercase">
                          {SLOT_LABELS[key]}
                        </p>
                        <p className="text-sm">{product.reason}</p>
                      </div>
                      <div className="flex sm:flex-1 flex-row sm:flex-col justify-between sm:justify-center items-center gap-2">
                        <p className="font-semibold">{product.price}</p>
                        <a href={product.link} target="_blank" rel="noopener noreferrer">
                          <Button>{cleanStoreName(product.source)}</Button>
                        </a>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-between">
                    <Button variant={"destructive"} onClick={close}>Kapat</Button>
                    <Button variant={"default"} onClick={analyzeAnother}>Yeni Analiz</Button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
