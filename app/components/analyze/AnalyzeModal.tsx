"use client";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useAnalyze } from "./useAnalyze";
import { ResultList } from "./ResultList"

const useIsMounted = () =>
  useSyncExternalStore(() => () => {}, () => true, () => false);

export default function AnalyzeModal({ userId }: { userId: string }) {
  const mounted = useIsMounted();
  const {
    open, stage, preview, results, error, fileInputRef,
    selectedFile, handleFileChange, start, close, analyzeAnother,
  } = useAnalyze(userId);

  if (!mounted) return null;

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} hidden />

      <label
        onClick={() => fileInputRef.current?.click()}
        className="min-h-48 mt-2 grid place-items-center content-center gap-2 text-foreground bg-[#0d111a] border border-dashed border-border/40 rounded-2xl overflow-hidden text-center cursor-pointer"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="önizleme" className="w-full h-56 object-cover rounded-xl" />
        ) : (
          <>
            <span>Ürün fotoğrafını yükle</span>
            <small className="text-muted-foreground">JPG, PNG veya ekran görüntüsü</small>
          </>
        )}
      </label>

      <Button onClick={start} disabled={!selectedFile || stage === "loading"} variant="default" size="full">
        Analiz Et
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={stage !== "loading" ? close : undefined}>
          <div className="w-1xl max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card border radius-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>

            {stage === "loading" && (
              <div className="w-full max-w-sm mx-auto text-center p-5 ">
                <div className="w-20 h-20 mx-auto mb-6 mt-2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#F8FAFC,#4F7CFF_34%,#17213B_68%)] shadow-[0_0_70px_rgba(79,124,255,0.38)] animate-pulse" />
                <h2 className="text-2xl font-bold leading-none">Analiz ediliyor</h2>
                <div className="grid gap-2 mt-6 text-left">
                  {["Ürün okunuyor", "Mağazalar taranıyor", "Alternatifler karşılaştırılıyor"].map((s) => (
                    <div key={s} className="px-4 py-3 text-foreground bg-white/4 border border-secondary/40 rounded-2xl">{s}</div>
                  ))}
                  <div className="px-4 py-3 text-muted-foreground bg-white/4 border border-border rounded-2xl">Sonuç hazırlanıyor</div>
                </div>
              </div>
            )}

            {stage === "error" && (
              <div className="w-full max-w-sm mx-auto flex flex-col gap-4 items-start p-5">
                <h2 className="text-xl font-bold">Sonuç bulunamadı</h2>
                <p className="text-sm text-muted-foreground">{error}</p>
                <p className="text-sm text-muted-foreground">Ürünün net göründüğü, iyi aydınlatılmış bir fotoğrafla tekrar deneyebilirsin.</p>
                <Button variant="default" onClick={analyzeAnother}>Tekrar Dene</Button>
              </div>
            )}

            {stage === "result" && results && (
              <ResultList results={results} preview={preview} close={close} analyzeAnother={analyzeAnother} />
            )}

          </div>
        </div>
      )}
    </>
  );
}