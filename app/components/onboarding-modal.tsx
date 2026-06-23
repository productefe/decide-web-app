"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

type Props = {
  userId: string;
};

const PREFERENCE_OPTIONS = [
  "Rahatlık & Konfor",
  "Minimalist & Sade",
  "Gösterişli & İddialı",
  "Teknoloji Tutkunu",
  "Spor & Egzersiz",
  "Evcimen",
  "Maceracı & Doğa",
  "Lüks & Kalite",
  "Trend & Moda",
];

const inputClass =
  "bg-muted text-center border border-border rounded-md px-4 py-3 text-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 min-h-[48px] w-full";

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex justify-center gap-2 mb-6">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-0.5 w-8 rounded-full transition-colors ${
            i <= step ? "bg-secondary" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}

export default function OnboardingModal({ userId }: Props) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0 && !height) {
      setError("Lütfen boyunu gir.");
      return;
    }
    if (step === 1 && !weight) {
      setError("Lütfen kilonu gir.");
      return;
    }

    setError(null);
    setStep(step + 1);
  };

  const togglePreference = (pref: string) => {
    setPreferences((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preferences.length === 0) {
      setError("Lütfen en az bir tercih seç.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error: dbError } = await supabase.from("user_preferences").upsert({
      id: userId,
      height,
      weight,
      preferences,
    });

    setLoading(false);

    if (dbError) {
      setError("Veriler kaydedilirken bir hata oluştu: " + dbError.message);
      return;
    }

    setOpen(false);
    router.refresh();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-lg p-6 md:p-8">
        <StepIndicator step={step} />

        <div className="mb-6 text-center border-b border-border pb-4">
          <h2 className="text-2xl font-bold tracking-wide mb-2">Seni tanıyalım</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Sana en uygun önerileri verebilmemiz için birkaç detay paylaş.
          </p>
        </div>

        {error && (
          <div className="bg-destructive/20 text-destructive-foreground text-sm px-4 py-3 rounded-md mb-4 border border-destructive/30">
            {error}
          </div>
        )}

        {step === 0 && (
          <form onSubmit={handleNext} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="height" className="text-sm font-bold text-center">
                Boyun kaç?
              </label>
              <input
                id="height"
                type="number"
                placeholder="Örn: 180"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className={inputClass}
                autoFocus
              />
            </div>
            <Button type="submit" size="full">
              İleri
            </Button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleNext} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="weight" className="text-sm font-bold text-center">
                Kilon kaç?
              </label>
              <input
                id="weight"
                type="number"
                placeholder="Örn: 75"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={inputClass}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(0)} className="flex-1" size="full">
                Geri
              </Button>
              <Button type="submit" className="flex-1" size="full">
                İleri
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-center">
                Tarzın ve önceliklerin neler?
              </label>
              <p className="text-xs text-muted-foreground text-center">Birden fazla seçebilirsin.</p>

              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {PREFERENCE_OPTIONS.map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => togglePreference(pref)}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      preferences.includes(pref)
                        ? "bg-secondary text-secondary-foreground border-secondary"
                        : "bg-muted text-foreground border-border hover:border-accent/50"
                    }`}
                  >
                    {pref}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button type="button" disabled={loading} variant="outline" onClick={() => setStep(1)} className="flex-1" size="full">
                Geri
              </Button>
              <Button type="submit" disabled={loading} className="flex-[2]" size="full">
                {loading ? "Kaydediliyor..." : "Tamamla"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
