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
  type UserPreferencesRow,
} from "@/lib/preferences";

type Props = {
  userId: string;
  initial: UserPreferencesRow;
};

export default function ProfileForm({ userId, initial }: Props) {
  const router = useRouter();
  const [height, setHeight] = useState(initial.height ?? "");
  const [weight, setWeight] = useState(initial.weight ?? "");
  const [gender, setGender] = useState<UserGender | "">(initial.gender ?? "");
  const [style, setStyle] = useState(initial.preferences?.[0] ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!height || !weight || !gender || !style) {
      setError("Tüm alanları doldur.");
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

    router.push("/workspace");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="bg-destructive/15 text-destructive text-sm px-4 py-3 rounded-xl border border-destructive/25">
          {error}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="profile-height" className="text-sm font-medium text-foreground">
            Boy (cm)
          </label>
          <input
            id="profile-height"
            type="number"
            placeholder="Örn: 180"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="profile-weight" className="text-sm font-medium text-foreground">
            Kilo (kg)
          </label>
          <input
            id="profile-weight"
            type="number"
            placeholder="Örn: 75"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={inputClass}
          />
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
