"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { createClient } from "@/utils/supabase/client";
import { inputClass } from "@/lib/input-styles";
import {
  GENDER_OPTIONS,
  PREFERENCE_OPTIONS,
  type UserGender,
} from "@/lib/preferences";

type Props = {
  userId: string;
};

const STEPS = ["Boy", "Kilo", "Cinsiyet", "Tarz"];

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

export default function OnboardingModal({ userId }: Props) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState<UserGender | "">("");
  const [style, setStyle] = useState("");

  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0 && !height) {
      setError("Boyunu yazmayı unutma.");
      return;
    }
    if (step === 1 && !weight) {
      setError("Kilonu yazmayı unutma.");
      return;
    }
    if (step === 2 && !gender) {
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
      height,
      weight,
      gender,
      preferences: [style],
    });

    setLoading(false);

    if (dbError) {
      setError("Kaydederken bir sorun oldu: " + dbError.message);
      return;
    }

    setOpen(false);
    router.refresh();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 md:p-8 shadow-xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />

        <StepIndicator step={step} />

        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            Sana özel öneriler için 4 kısa soru
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Bir dakikadan kısa sürer, sonra aramaya hazırsın.
          </p>
        </div>

        {error && (
          <div className="bg-destructive/15 text-destructive text-sm px-4 py-3 rounded-xl mb-4 border border-destructive/25">
            {error}
          </div>
        )}

        {step === 0 && (
          <form onSubmit={handleNext} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="height" className="text-sm font-medium text-center text-foreground">
                Boyun kaç cm?
              </label>
              <input
                id="height"
                type="number"
                placeholder="Örn: 180"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className={inputClass + " text-center"}
                autoFocus
              />
            </div>
            <Button type="submit" size="full">
              Devam et
            </Button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleNext} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="weight" className="text-sm font-medium text-center text-foreground">
                Kilon kaç kg?
              </label>
              <input
                id="weight"
                type="number"
                placeholder="Örn: 75"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={inputClass + " text-center"}
                autoFocus
              />
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
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1" size="full">
                Geri
              </Button>
              <Button type="submit" className="flex-1" size="full">
                Devam et
              </Button>
            </div>
          </form>
        )}

        {step === 3 && (
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
                onClick={() => setStep(2)}
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
