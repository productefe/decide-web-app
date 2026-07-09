"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
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

function StepIndicator({ step }: { step: number }) {
  const progress = ((step + 1) / STEPS.length) * 100;
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs font-medium text-muted-foreground mb-2">
        <span>
          Adım {step + 1} / {STEPS.length}
        </span>
        <span>{STEPS[step]}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in">
      <div className="w-full sm:max-w-sm bg-card border border-border border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl p-6 md:p-8 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl max-h-[92vh] overflow-y-auto overscroll-contain animate-fade-in-up">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />

        <StepIndicator step={step} />

        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            Sana özel öneriler için 3 kısa soru
          </h2>
        </div>

        {error && (
          <div className="bg-destructive/15 text-destructive text-sm px-4 py-3 rounded-xl mb-4 border border-destructive/25">
            {error}
          </div>
        )}

        {step === 0 && (
          <form onSubmit={handleNext} className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-center text-foreground">
                Hangi bedenlerde ürün görmek istersin?
              </label>
              <p className="text-xs text-muted-foreground text-center">Birden fazla seçebilirsin.</p>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSizes((prev) => toggleSize(prev, size))}
                    className={`min-h-[44px] min-w-[52px] px-3 py-2 text-sm rounded-xl border transition-all ${
                      sizes.includes(size)
                        ? "bg-secondary text-secondary-foreground border-secondary shadow-sm"
                        : "bg-muted text-foreground border-border hover:border-accent/50"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" size="full">
              Devam et
            </Button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleNext} className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-center text-foreground">Cinsiyet</label>
              <div className="flex gap-2">
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(opt.value)}
                    className={`flex-1 min-h-[48px] rounded-xl border text-sm font-medium transition-all ${
                      gender === opt.value
                        ? "bg-secondary text-secondary-foreground border-secondary shadow-sm"
                        : "bg-muted text-foreground border-border hover:border-accent/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
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
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-center text-foreground">Tarzın nasıl?</label>
              <p className="text-xs text-muted-foreground text-center">Bir tane seç.</p>

              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {PREFERENCE_OPTIONS.map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setStyle(pref)}
                    className={`min-h-[44px] px-3 py-2 text-sm rounded-xl border transition-all ${
                      style === pref
                        ? "bg-secondary text-secondary-foreground border-secondary shadow-sm"
                        : "bg-muted text-foreground border-border hover:border-accent/50"
                    }`}
                  >
                    {pref}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
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
    </div>
  );
}
