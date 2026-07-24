"use client";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Camera, ImagePlus, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecideLogo } from "@/components/decide-logo";
import Modal from "@/components/modal";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
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
    open,
    stage,
    preview,
    pieces,
    reasonsLoading,
    error,
    galleryInputRef,
    cameraInputRef,
    sourceSheetOpen,
    sourceSheetReady,
    selectedFile,
    handleFileChange,
    openPhotoPicker,
    pickFromGallery,
    pickFromCamera,
    closeSourceSheet,
    start,
    close,
    analyzeAnother,
  } = useAnalyze(userId, { guestMode, onAnalysisComplete });

  useBodyScrollLock(open);

  const inlineError = error && !open ? error : null;

  if (!mounted) return null;

  return (
    <>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="sr-only"
        tabIndex={-1}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only"
        tabIndex={-1}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => openPhotoPicker()}
          className={`relative flex min-h-[13rem] flex-1 cursor-pointer touch-manipulation flex-col place-content-center gap-3 overflow-hidden rounded-2xl px-4 py-8 text-center text-foreground transition-all duration-300 animate-press ${
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
              className="h-52 w-full rounded-xl object-cover shadow-sm ring-1 ring-border"
            />
          ) : (
            <>
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary shadow-sm ring-4 ring-secondary/10">
                <ImagePlus className="size-7" aria-hidden />
              </span>
              <span className="text-lg font-semibold text-foreground">Fotoğrafını buraya bırak</span>
              <small className="text-sm text-muted-foreground">Galeriden seç veya çek · JPG, PNG</small>
            </>
          )}
        </button>

        {inlineError ? (
          <p className="mt-3 shrink-0 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {inlineError}
          </p>
        ) : null}

        <Button
          onClick={start}
          disabled={!selectedFile || stage === "loading"}
          variant="default"
          size="full"
          className="relative mt-4 min-h-[48px] shrink-0 shadow-sm"
          aria-label="Analiz et"
        >
          <DecideLogo light className="mx-auto h-5 w-auto" />
        </Button>

        <p className="relative mt-4 shrink-0 rounded-xl border border-secondary/20 bg-gradient-to-r from-secondary/5 to-accent/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {PHOTO_DISCLAIMER}
        </p>
      </div>

      <Modal open={sourceSheetOpen} onClose={sourceSheetReady ? closeSourceSheet : () => {}}>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Fotoğraf ekle</h2>
        <div
          className={`flex flex-col gap-2 transition-opacity ${sourceSheetReady ? "opacity-100" : "pointer-events-none opacity-60"}`}
        >
          <button
            type="button"
            onClick={pickFromGallery}
            className="flex min-h-[48px] cursor-pointer touch-manipulation items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Images className="size-5 shrink-0 text-secondary" aria-hidden />
            Galeriden seç
          </button>
          <button
            type="button"
            onClick={pickFromCamera}
            className="flex min-h-[48px] cursor-pointer touch-manipulation items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Camera className="size-5 shrink-0 text-secondary" aria-hidden />
            Kameradan çek
          </button>
          <Button type="button" variant="ghost" onClick={closeSourceSheet} className="mt-1 min-h-[48px]">
            Vazgeç
          </Button>
        </div>
      </Modal>

      {open && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[100]">
              <button
                type="button"
                aria-label="Kapat"
                className="absolute inset-0 touch-none bg-black/60 backdrop-blur-sm"
                onClick={stage !== "loading" ? close : undefined}
              />
              <div
                className={`fixed bottom-0 inset-x-0 z-10 mx-auto w-full max-w-2xl rounded-t-2xl border-t border-border bg-card shadow-xl animate-fade-in-up ${
                  stage === "result" ? "flex max-h-[92dvh] flex-col overflow-hidden" : ""
                }`}
                style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
              >
                <div className="mx-auto mb-4 mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden />

                {stage === "loading" ? (
                  <div className="px-6 pb-4">
                    <AnalyzeLoadingProgress steps={DEFAULT_LOADING_STEPS} />
                  </div>
                ) : null}

                {stage === "error" ? (
                  <div className="mx-auto flex w-full max-w-sm flex-col items-start gap-4 px-6 pb-4 py-2">
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
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4">
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
                  </div>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
