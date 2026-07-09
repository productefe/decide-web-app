"use client";
import { useSyncExternalStore } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecideLogo } from "@/components/decide-logo";
import { BottomSheet } from "@/components/bottom-sheet";
import { useAnalyze } from "./useAnalyze";
import { ResultList } from "./ResultList";
import { AnalyzeLoadingProgress, DEFAULT_LOADING_STEPS } from "./AnalyzeLoadingProgress";

const useIsMounted = () =>
  useSyncExternalStore(() => () => {}, () => true, () => false);

export const PHOTO_DISCLAIMER =
  "Kombin fotoğrafında parçalar ayrı ayrı analiz edilir.";

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
    open, stage, preview, pieces, reasonsLoading, error, fileInputRef,
    selectedFile, handleFileChange, openPhotoPicker, start, close, analyzeAnother,
  } = useAnalyze(userId, { guestMode, onAnalysisComplete });

  const inlineError = error && !open ? error : null;

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

      <div>
        <label
          onClick={() => openPhotoPicker()}
          className={`relative grid min-h-[9.5rem] place-items-center content-center gap-2.5 overflow-hidden rounded-2xl px-4 py-5 text-center text-foreground transition-all duration-300 animate-press touch-manipulation sm:min-h-[11rem] sm:gap-3 sm:py-6 ${
            preview
              ? "cursor-pointer border-2 border-secondary/30 bg-gradient-to-br from-card to-secondary/[0.04] shadow-sm ring-1 ring-secondary/10"
              : "cursor-pointer border-2 border-dashed border-secondary/25 bg-gradient-to-br from-muted/90 to-secondary/[0.06] hover:border-secondary/45 hover:shadow-md hover:-translate-y-0.5"
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Seçtiğin fotoğraf"
              className="h-36 w-full rounded-xl object-cover shadow-sm ring-1 ring-border sm:h-44"
            />
          ) : (
            <>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary shadow-sm ring-4 ring-secondary/10 sm:size-14">
                <ImagePlus className="size-6 sm:size-7" aria-hidden />
              </span>
              <span className="text-base font-semibold text-foreground sm:text-lg">
                Fotoğrafını buraya bırak
              </span>
              <small className="text-xs text-muted-foreground sm:text-sm">
                Galeriden seç veya çek · JPG, PNG
              </small>
            </>
          )}
        </label>

        {inlineError ? (
          <p className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {inlineError}
          </p>
        ) : null}

        <Button
          onClick={start}
          disabled={!selectedFile || stage === "loading"}
          variant="default"
          size="full"
          className="relative mt-3 min-h-[48px] shadow-sm sm:mt-4"
          aria-label="Analiz et"
        >
          <DecideLogo light className="mx-auto h-5 w-auto" />
        </Button>

        <p className="relative mt-3 rounded-xl border border-secondary/20 bg-gradient-to-r from-secondary/5 to-accent/5 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground sm:mt-4 sm:px-4 sm:py-3 sm:text-xs">
          {PHOTO_DISCLAIMER}
        </p>
      </div>

      {open ? (
        <BottomSheet
          open={open}
          onClose={stage !== "loading" ? close : undefined}
          scrollable={stage === "result"}
        >
          {stage === "loading" ? <AnalyzeLoadingProgress steps={DEFAULT_LOADING_STEPS} /> : null}

          {stage === "error" ? (
            <div className="mx-auto flex w-full max-w-sm flex-col items-start gap-4 py-1">
              <h2 className="text-xl font-semibold text-foreground">Sonuç bulamadık</h2>
              <p className="text-sm text-muted-foreground">
                {error || "Net, iyi aydınlatılmış bir ürün fotoğrafıyla tekrar dene."}
              </p>
              <Button variant="default" onClick={analyzeAnother} className="min-h-[48px]">
                Tekrar dene
              </Button>
            </div>
          ) : null}

          {stage === "result" && pieces ? (
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
          ) : null}
        </BottomSheet>
      ) : null}
    </>
  );
}
