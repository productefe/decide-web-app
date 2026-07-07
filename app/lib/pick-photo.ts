export async function pickProductPhoto(): Promise<{ file: File; preview: string } | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;

    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
    });

    if (!photo.dataUrl) return null;

    const res = await fetch(photo.dataUrl);
    const blob = await res.blob();
    const ext = photo.format === "png" ? "png" : "jpg";
    const file = new File([blob], `photo.${ext}`, { type: blob.type || `image/${ext}` });

    return { file, preview: photo.dataUrl };
  } catch {
    return null;
  }
}
