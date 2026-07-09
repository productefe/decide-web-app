"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { createClient } from "@/utils/supabase/client";
import {
  GENDER_OPTIONS,
  PREFERENCE_OPTIONS,
  SIZE_OPTIONS,
  type UserGender,
  type UserSize,
} from "@/lib/preferences";
import { saveGuestPrefsLocal } from "@/lib/guest";

type Props = {
  userId: string;
  redirectPath?: string;
  onComplete?: () => void;
};

const STEPS = ["Beden", "Cinsiyet", "Tarz"];

const useIsMounted = () =>
  useSyncExternalStore(() => () => {}, () => true, () => false);

function StepIndicator({ step }: { step: number }) {
  const progress = ((step + 1) / STEPS.length) * 100;
  return (
    <div className="mb-6 shrink-0">
      <div className="mb-2 flex justify-between text-xs font-medium text-muted-foreground">
        <span>
          Adım {step + 1} / {STEPS.length}
        </span>
        <span>{STEPS[step]}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-secondary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function toggleSize(selected: UserSize[], size: UserSize): UserSize[] {
  return selected.includes(size) ? selected.filter((s) => s !== size) : [...selected, size];
}

export default function OnboardingModal({ userId, redirectPath, onComplete }: Props) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  const [sizes, setSizes] = useState<UserSize[]>([]);
  const [gender, setGender] = useState<UserGender | "">("");
  const [style, setStyle] = useState("");

  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const mounted = useIsMounted();

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0 && sizes.length === 0) {
      setError("En az bir beden seç.");
      return;
    }
    if (step === 1 && !gender) {
      setError("Cinsiyet seçmeyi unutma.");
      return;
    }

    setError(null);
    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!style) {
      setError("Bir tarz seç, sana özel öneriler için lazım.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error: dbError } = await supabase.from("user_preferences").upsert({
      id: userId,
      sizes,
      gender,
      preferences: [style],
    });

    setLoading(false);

    if (dbError) {
      setError("Kaydederken bir sorun oldu: " + dbError.message);
      return;
    }

    saveGuestPrefsLocal({ sizes, gender: gender as UserGender, preferences: [style] });
    setOpen(false);
    onComplete?.();
    if (redirectPath) {
      router.push(redirectPath);
    } else {
      router.refresh();
    }
  };

  useBodyScrollLock(open);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-card animate-fade-in"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-lg flex-col px-5">
        <StepIndicator step={step} />

        <div className="mb-6 shrink-0 text-center">
          <h2 className="text-2xl font-semibold text-foreground">
            Sana özel öneriler için 3 kısa soru
          </h2>
        </div>

        {error && (
          <div className="mb-4 shrink-0 rounded-xl border border-destructive/25 bg-destructive/15 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === 0 && (
          <form onSubmit={handleNext} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 overflow-y-auto overscroll-contain">
              <div className="flex flex-col gap-3">
                <label className="text-center text-sm font-medium text-foreground">
                  Hangi bedenlerde ürün görmek istersin?
                </label>
                <p className="text-center text-xs text-muted-foreground">Birden fazla seçebilirsin.</p>
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSizes((prev) => toggleSize(prev, size))}
                      className={`min-h-[44px] min-w-[52px] rounded-xl border px-3 py-2 text-sm transition-all ${
                        sizes.includes(size)
                          ? "border-secondary bg-secondary text-secondary-foreground shadow-sm"
                          : "border-border bg-muted text-foreground hover:border-accent/50"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="shrink-0 pt-4">
              <Button type="submit" size="full">
                Devam et
              </Button>
            </div>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleNext} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 overflow-y-auto overscroll-contain">
              <div className="flex flex-col gap-3">
                <label className="text-center text-sm font-medium text-foreground">Cinsiyet</label>
                <div className="flex gap-2">
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGender(opt.value)}
                      className={`min-h-[48px] flex-1 rounded-xl border text-sm font-medium transition-all ${
                        gender === opt.value
                          ? "border-secondary bg-secondary text-secondary-foreground shadow-sm"
                          : "border-border bg-muted text-foreground hover:border-accent/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setStep(0)} className="flex-1" size="full">
                Geri
              </Button>
              <Button type="submit" className="flex-1" size="full">
                Devam et
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 overflow-y-auto overscroll-contain">
              <div className="flex flex-col gap-3">
                <label className="text-center text-sm font-medium text-foreground">Tarzın nasıl?</label>
                <p className="text-center text-xs text-muted-foreground">Bir tane seç.</p>

                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {PREFERENCE_OPTIONS.map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => setStyle(pref)}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-sm transition-all ${
                        style === pref
                          ? "border-secondary bg-secondary text-secondary-foreground shadow-sm"
                          : "border-border bg-muted text-foreground hover:border-accent/50"
                      }`}
                    >
                      {pref}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 gap-2 border-t border-border pt-4">
              <Button
                type="button"
                disabled={loading}
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
                size="full"
              >
                Geri
              </Button>
              <Button type="submit" disabled={loading} className="flex-[2]" size="full">
                {loading ? "Kaydediliyor..." : "Bitir"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
