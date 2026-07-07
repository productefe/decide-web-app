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
    selectedFile, handleFileChange, openPhotoPicker, start, close, analyzeAnother,
  } = useAnalyze(userId);

  if (!mounted) return null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        hidden
      />

      <label
        onClick={() => openPhotoPicker()}
        className="min-h-[11rem] grid place-items-center content-center gap-2 text-foreground bg-muted border border-dashed border-border rounded-lg overflow-hidden text-center cursor-pointer hover:border-accent/50 transition-colors touch-manipulation py-6"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="önizleme" className="w-full h-52 object-cover" />
        ) : (
          <>
            <span className="text-secondary tracking-wide">Ürün fotoğrafını yükle</span>
            <small className="text-muted-foreground text-sm">JPG, PNG veya ekran görüntüsü</small>
          </>
        )}
      </label>

      <Button onClick={start} disabled={!selectedFile || stage === "loading"} variant="default" size="full" className="mt-4">
        Analiz Et
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={stage !== "loading" ? close : undefined}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card border border-border p-6 overscroll-contain" onClick={(e) => e.stopPropagation()}>

            {stage === "loading" && (
              <div className="w-full max-w-sm mx-auto text-center py-4">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary/15 border border-secondary/40 animate-pulse" />
                <h2 className="text-2xl font-bold tracking-wide">Analiz ediliyor</h2>
                <div className="grid gap-2 mt-6 text-left">
                  {["Ürün okunuyor", "Mağazalar taranıyor", "Alternatifler karşılaştırılıyor"].map((s) => (
                    <div key={s} className="px-4 py-3 text-foreground bg-muted border border-border rounded-md">{s}</div>
                  ))}
                  <div className="px-4 py-3 text-muted-foreground bg-muted border border-border rounded-md">Sonuç hazırlanıyor</div>
                </div>
              </div>
            )}

            {stage === "error" && (
              <div className="w-full max-w-sm mx-auto flex flex-col gap-4 items-start py-2">
                <h2 className="text-xl font-bold tracking-wide">Sonuç bulunamadı</h2>
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
