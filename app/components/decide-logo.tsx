/* eslint-disable @next/next/no-img-element */

type Props = {
  className?: string;
  /** Beyaz logo — koyu/yeşil arka plan üzerinde kullan */
  light?: boolean;
};

export function DecideLogo({ className = "h-7 w-auto", light = false }: Props) {
  return (
    <img
      src={light ? "/decide-logo-white.png" : "/decide-logo.png"}
      alt="DECIDE"
      className={`object-contain object-left ${className}`}
    />
  );
}
