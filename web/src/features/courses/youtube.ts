/** `watch?v=ID`, `youtu.be/ID` veya `embed/ID` bağlantısından küçük resim adresi üretir. */
export function youTubeThumbnail(url: string | null | undefined): string | null {
  const match = url?.match(/(?:watch\?v=|youtu\.be\/|embed\/)([\w-]{6,})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}
