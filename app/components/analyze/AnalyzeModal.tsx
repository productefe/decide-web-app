"use client";
import { useSyncExternalStore } from "react";
import { ImagePlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalyze } from "./useAnalyze";
import { ResultList } from "./ResultList";
import { AnalyzeLoadingProgress, DEFAULT_LOADING_STEPS } from "./AnalyzeLoadingProgress";

const useIsMounted = () =>
  useSyncExternalStore(() => () => {}, () => true, () => false);

export const PHOTO_DISCLAIMER =
  "Kombin fotoğrafında parçalar ayrı ayrı analiz edilir; tek parça fotoğrafında o parça aranır.";

export default function AnalyzeModal({
  userId,
  guestMode = false,
  onSignup,
  onAnalysisComplete,
}: {
  userId: string;
  guestMode?: boolean;
  onSignup?: () => void;
  onAnalysisComplete?: () => void;
}) {
  const mounted = useIsMounted();
  const {
    open, stage, preview, pieces, reasonsLoading, fileInputRef,
    selectedFile, handleFileChange, openPhotoPicker, start, close, analyzeAnother,
  } = useAnalyze(userId, { guestMode, onAnalysisComplete });

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

      <div className="relative">
        <div
          className="pointer-events-none absolute -top-6 -left-4 h-28 w-28 rounded-full bg-secondary/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-4 -right-2 h-24 w-24 rounded-full bg-accent/10 blur-2xl"
          aria-hidden
        />

        <label
          onClick={() => openPhotoPicker()}
          className={`relative min-h-[13rem] grid place-items-center content-center gap-3 text-foreground rounded-2xl overflow-hidden text-center cursor-pointer touch-manipulation py-8 px-4 transition-all ${
            preview
              ? "border-2 border-secondary/30 bg-gradient-to-br from-card to-secondary/[0.04] shadow-sm ring-1 ring-secondary/10"
              : "border-2 border-dashed border-secondary/25 bg-gradient-to-br from-muted/90 to-secondary/[0.06] hover:border-secondary/45 hover:shadow-md hover:-translate-y-0.5"
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Seçtiğin fotoğraf"
              className="w-full h-52 object-cover rounded-xl shadow-sm ring-1 ring-border"
            />
          ) : (
            <>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary ring-4 ring-secondary/10 shadow-sm">
                <ImagePlus className="size-7" aria-hidden />
              </span>
              <span className="font-semibold text-foreground text-lg">Fotoğrafını buraya bırak</span>
              <small className="text-muted-foreground text-sm">Galeriden seç veya çek · JPG, PNG</small>
            </>
          )}
        </label>

        <Button
          onClick={start}
          disabled={!selectedFile || stage === "loading"}
          variant="default"
          size="full"
          className="relative mt-4 min-h-[48px] shadow-sm gap-2"
        >
          <Sparkles className="size-4" aria-hidden />
          Analiz et
        </Button>

        <p className="relative mt-4 text-xs text-muted-foreground leading-relaxed rounded-xl border border-secondary/20 bg-gradient-to-r from-secondary/5 to-accent/5 px-4 py-3">
          {PHOTO_DISCLAIMER}
        </p>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0 sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            aria-label="Kapat"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={stage !== "loading" ? close : undefined}
          />
          <div
            className="relative z-10 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-border sm:shadow-xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] overscroll-contain"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />

            {stage === "loading" && (
              <AnalyzeLoadingProgress steps={DEFAULT_LOADING_STEPS} />
            )}

            {stage === "error" && (
              <div className="w-full max-w-sm mx-auto flex flex-col gap-4 items-start py-2">
                <h2 className="text-xl font-semibold text-foreground">Sonuç bulamadık</h2>
                <p className="text-sm text-muted-foreground">Net, iyi aydınlatılmış bir ürün fotoğrafıyla tekrar dene.</p>
                <Button variant="default" onClick={analyzeAnother}>Tekrar dene</Button>
              </div>
            )}

            {stage === "result" && pieces && (
              <ResultList
                pieces={pieces}
                preview={preview}
                userId={userId}
                guestMode={guestMode}
                onSignup={onSignup}
                reasonsLoading={reasonsLoading}
                close={close}
                analyzeAnother={guestMode ? close : analyzeAnother}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
