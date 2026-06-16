"use client";
import { useState, useRef, useSyncExternalStore } from "react";
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

  // Avoid SSR hydration mismatch
  const useIsMounted = () =>
    useSyncExternalStore(
      () => () => {},
      () => true,
      () => false,
    );

  const mounted = useIsMounted();
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

      const {
        data: { publicUrl },
      } = supabase.storage.from("product-photos").getPublicUrl(fileName);

      const response = await fetch(
        "https://emavia.app.n8n.cloud/webhook/decide",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo_url: publicUrl, user_id: userId }),
        },
      );

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
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        hidden
        className="absolute w-px h-px opacity-0"
      />

      <label
        onClick={() => fileInputRef.current?.click()}
        className="min-h-48 mt-2 grid place-items-center content-center gap-2 text-foreground bg-[#0d111a] border border-dashed border-border/40 rounded-2xl overflow-hidden text-center cursor-pointer"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="önizleme"
            className="w-full h-56 object-cover rounded-xl"
          />
        ) : (
          <>
            <span>Ürün fotoğrafını yükle</span>
            <small className="text-muted-foreground">
              JPG, PNG veya ekran görüntüsü
            </small>
          </>
        )}
      </label>

      <Button
        onClick={start}
        disabled={!selectedFile || stage === "loading"}
        variant="default"
        size="full"
      >
        Analiz Et
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={stage !== "loading" ? close : undefined}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card border border-border p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {stage === "loading" && (
              <div className="w-full max-w-sm mx-auto mt-20 text-center p-5 bg-card border border-border rounded-3xl shadow-2xl">
                <div className="w-20 h-20 mx-auto mb-6 mt-2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#F8FAFC,#4F7CFF_34%,#17213B_68%)] shadow-[0_0_70px_rgba(79,124,255,0.38)] animate-pulse" />
                <h2 className="text-2xl font-bold leading-none">
                  Analiz ediliyor
                </h2>
                <div className="grid gap-2 mt-6 text-left">
                  <div className="px-4 py-3 text-foreground bg-white/4 border border-secondary/40 rounded-2xl">
                    Ürün okunuyor
                  </div>
                  <div className="px-4 py-3 text-foreground bg-white/4 border border-secondary/40 rounded-2xl">
                    Mağazalar taranıyor
                  </div>
                  <div className="px-4 py-3 text-foreground bg-white/4 border border-secondary/40 rounded-2xl">
                    Alternatifler karşılaştırılıyor
                  </div>
                  <div className="px-4 py-3 text-muted-foreground bg-white/4 border border-border rounded-2xl">
                    Sonuç hazırlanıyor
                  </div>
                </div>
              </div>
            )}

            {stage === "error" && (
              <div className="w-full max-w-sm mx-auto flex flex-col gap-4 items-start p-5 bg-card border border-border rounded-3xl shadow-2xl">
                <h2 className="text-xl font-bold">Sonuç bulunamadı</h2>
                <p className="text-sm text-muted-foreground">{error}</p>
                <p className="text-sm text-muted-foreground">
                  Ürünün net göründüğü, iyi aydınlatılmış bir fotoğrafla tekrar
                  deneyebilirsin.
                </p>
                <Button variant="default" onClick={analyzeAnother}>
                  Tekrar Dene
                </Button>
              </div>
            )}

            {stage === "result" && results && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-secondary text-xs font-extrabold tracking-widest uppercase">
                    Sonuçlar
                  </p>
                  {preview && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Aradığın ürün
                      </span>
                      <img
                        src={preview}
                        alt="aradığın ürün"
                        className="w-12 h-12 object-cover rounded-lg border border-border"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-10">
                  {slots
                    .filter((s) => s.product)
                    .map(
                      ({ key, product }) =>
                        product && (
                          <div
                            key={key}
                            className="flex flex-col sm:flex-row gap-4 sm:gap-2 sm:justify-center"
                          >
                            <div className="flex sm:flex-[2] justify-center">
                              {product.image && (
                                <img
                                  src={product.image}
                                  alt={product.title}
                                  width={160}
                                  height={160}
                                  className="object-cover rounded-xl"
                                />
                              )}
                            </div>
                            <div className="flex sm:flex-[3] flex-col justify-center">
                              <p className="text-xl text-secondary font-extrabold uppercase">
                                {SLOT_LABELS[key]}
                              </p>
                              <p className="text-sm">{product.reason}</p>
                            </div>
                            <div className="flex sm:flex-[1] flex-row sm:flex-col justify-between sm:justify-center items-center gap-2">
                              <p className="font-semibold">{product.price}</p>
                              <a
                                href={product.link}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  variant={"secondary"}
                                >
                                  {cleanStoreName(product.source)}
                                </Button>
                              </a>
                            </div>
                          </div>
                        ),
                    )}

                  <div className="flex justify-between">
                    <Button variant="destructive" onClick={close}>
                      Kapat
                    </Button>
                    <Button variant="default" onClick={analyzeAnother}>
                      Yeni Analiz
                    </Button>
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
