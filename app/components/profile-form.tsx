"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { createClient } from "@/utils/supabase/client";
import {
  GENDER_OPTIONS,
  PREFERENCE_OPTIONS,
  SIZE_OPTIONS,
  parseSizes,
  type UserGender,
  type UserPreferencesRow,
  type UserSize,
} from "@/lib/preferences";

type Props = {
  userId: string;
  initial: UserPreferencesRow;
};

function toggleSize(selected: UserSize[], size: UserSize): UserSize[] {
  return selected.includes(size) ? selected.filter((s) => s !== size) : [...selected, size];
}

export default function ProfileForm({ userId, initial }: Props) {
  const router = useRouter();
  const [sizes, setSizes] = useState<UserSize[]>(parseSizes(initial.sizes) as UserSize[]);
  const [gender, setGender] = useState<UserGender | "">(initial.gender ?? "");
  const [style, setStyle] = useState(initial.preferences?.[0] ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizes.length || !gender || !style) {
      setError("Tüm alanları doldur.");
      return;
    }

    setLoading(true);
    setError(null);
    setSaved(false);

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

    setSaved(true);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="bg-destructive/15 text-destructive text-sm px-4 py-3 rounded-xl border border-destructive/25">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-secondary/15 text-secondary text-sm px-4 py-3 rounded-xl border border-secondary/25">
          Tercihlerin kaydedildi.
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Bedenlerin</span>
        <p className="text-xs text-muted-foreground">Hangi bedenlerde ürün görmek istersin? Birden fazla seçebilirsin.</p>
        <div className="flex flex-wrap gap-2">
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

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Cinsiyet</span>
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

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Tarzın</span>
        <p className="text-xs text-muted-foreground">Bir tane seç.</p>
        <div className="flex flex-wrap gap-2">
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

      <Button type="submit" disabled={loading} size="full">
        {loading ? "Kaydediliyor..." : "Kaydet"}
      </Button>
    </form>
  );
}
