"use client";
import { useSyncExternalStore } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalyze } from "./useAnalyze";
import { ResultList } from "./ResultList";

const useIsMounted = () =>
  useSyncExternalStore(() => () => {}, () => true, () => false);

const LOADING_STEPS = [
  "Fotoğrafına bakıyoruz",
  "Mağazaları tarıyoruz",
  "En iyi eşleşmeleri seçiyoruz",
  "Sonuçları hazırlıyoruz",
];

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
        className="min-h-[12rem] grid place-items-center content-center gap-3 text-foreground bg-muted/80 border-2 border-dashed border-border rounded-2xl overflow-hidden text-center cursor-pointer hover:border-accent/60 hover:bg-muted transition-colors touch-manipulation py-8 px-4"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Seçtiğin fotoğraf" className="w-full h-52 object-cover rounded-xl shadow-sm" />
        ) : (
          <>
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary/10 text-secondary">
              <ImagePlus className="size-6" aria-hidden />
            </span>
            <span className="font-semibold text-foreground">Fotoğrafını buraya bırak</span>
            <small className="text-muted-foreground text-sm">Galeriden seç veya çek · JPG, PNG</small>
          </>
        )}
      </label>

      <Button onClick={start} disabled={!selectedFile || stage === "loading"} variant="default" size="full" className="mt-4 shadow-sm">
        Analiz et
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 pb-0 sm:pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={stage !== "loading" ? close : undefined}>
          <div
            className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-border sm:shadow-xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />

            {stage === "loading" && (
              <div className="w-full max-w-sm mx-auto text-center py-2">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-secondary/10 border-2 border-secondary/30 animate-pulse" />
                <h2 className="text-xl font-semibold text-foreground">Bakıyoruz...</h2>
                <p className="text-sm text-muted-foreground mt-1">Bu birkaç saniye sürebilir</p>
                <div className="grid gap-2 mt-6 text-left">
                  {LOADING_STEPS.map((s, i) => (
                    <div
                      key={s}
                      className={`px-4 py-3 rounded-xl border text-sm ${
                        i < LOADING_STEPS.length - 1
                          ? "bg-muted border-border text-foreground"
                          : "bg-muted/50 border-border text-muted-foreground"
                      }`}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stage === "error" && (
              <div className="w-full max-w-sm mx-auto flex flex-col gap-4 items-start py-2">
                <h2 className="text-xl font-semibold text-foreground">Sonuç bulamadık</h2>
                <p className="text-sm text-muted-foreground">{error}</p>
                <p className="text-sm text-muted-foreground">Net, iyi aydınlatılmış bir ürün fotoğrafıyla tekrar dene.</p>
                <Button variant="default" onClick={analyzeAnother}>Tekrar dene</Button>
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
