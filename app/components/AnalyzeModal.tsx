'use client'
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

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
    if (!selectedFile) return;
    setOpen(true);
    setStage("loading");
    setError(null);

    try {
      const supabase = createClient();

      // 1. Supabase Storage'a yükle
      const fileName = `${userId}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(fileName, selectedFile);

      if (uploadError) throw new Error("Fotoğraf yüklenemedi: " + uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from("product-photos")
        .getPublicUrl(fileName);

      // 2. n8n webhook'a gönder
      const response = await fetch("https://emavia.app.n8n.cloud/webhook/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_url: publicUrl, user_id: userId }),
      });

      const data = await response.json();
      
      // n8n [{ results: {...} }] formatında dönüyor
      const res = data[0]?.results || data?.results;
      if (!res) throw new Error("Sonuç alınamadı");

      // 3. Supabase'e kaydet
      await supabase.from("search_history").insert({
        user_id: userId,
        photo_url: publicUrl,
        results: res,
      });

      setResults(res);
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

  return (
    <>
      {/* FILE INPUT */}
      <label>Product photo
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
      </label>

      <label className="upload-box" onClick={() => fileInputRef.current?.click()}>
        <span>Tap to upload product photo</span>
        <small>JPG, PNG, or phone screenshot</small>
        {preview && (
          <img src={preview} alt="preview" style={{ maxHeight: 200, marginTop: 8, borderRadius: 8 }} />
        )}
      </label>

      <button
        onClick={start}
        disabled={!selectedFile}
        className="primary-btn full"
      >
        Analyze
      </button>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-2xl rounded-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>

            {/* LOADING */}
            {stage === "loading" && (
              <div className="loading-card">
                <div className="orb" />
                <h2>Analyzing</h2>
                <div className="steps">
                  <div className="step active">Reading product</div>
                  <div className="step active">Checking price</div>
                  <div className="step active">Comparing alternatives</div>
                  <div className="step">Preparing answer</div>
                </div>
              </div>
            )}

            {/* ERROR */}
            {stage === "error" && (
              <div className="result-card">
                <h2>Bir hata oluştu</h2>
                <p>{error}</p>
                <button onClick={close} className="secondary-btn">Tekrar Dene</button>
              </div>
            )}

            {/* RESULTS */}
            {stage === "result" && results && (
              <div className="result-card">
                <p className="eyebrow">Results</p>

                {[results.recommended, results.cheaper, results.safer]
                  .filter(Boolean)
                  .map((product, i) => product && (
                    <div key={i} className="product-row" style={{ display: "flex", gap: 16, marginBottom: 24, alignItems: "flex-start" }}>
                      {product.image && (
                        <img src={product.image} alt={product.title} width={80} height={80} style={{ objectFit: "cover", borderRadius: 8 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <span className="label-badge">{product.label}</span>
                        <p className="product-title" style={{ fontWeight: 600, margin: "4px 0" }}>{product.title}</p>
                        <p className="product-price" style={{ color: "var(--blue)", fontWeight: 700 }}>{product.price}</p>
                        <p className="product-reason" style={{ fontSize: 13, color: "#666", margin: "4px 0 8px" }}>{product.reason}</p>
                        <a
                          href={product.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={i === 0 ? "success-btn" : "secondary-btn"}
                          style={{ display: "inline-block" }}
                        >
                          {product.store} → Gör
                        </a>
                      </div>
                    </div>
                  ))}

                <div className="result-actions">
                  <button className="secondary-btn" onClick={close}>Analyze Another</button>
                </div>
                <button onClick={close} className="text-sm text-gray-500 pt-2">Close</button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}