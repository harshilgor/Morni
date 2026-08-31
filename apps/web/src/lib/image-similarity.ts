export type ImageFingerprint = { bits: number[] };

export async function fingerprintImage(file: File): Promise<ImageFingerprint> {
  const bitmap = await createImageBitmap(file);
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not inspect image.");
  context.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  const pixels = context.getImageData(0, 0, size, size).data;
  const luminance: number[] = [];
  for (let index = 0; index < pixels.length; index += 4) {
    luminance.push(
      0.299 * pixels[index] +
        0.587 * pixels[index + 1] +
        0.114 * pixels[index + 2],
    );
  }
  const average =
    luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  return {
    bits: luminance.map((value) => (value >= average ? 1 : 0)),
  };
}

export function fingerprintDistance(a: ImageFingerprint, b: ImageFingerprint) {
  return a.bits.reduce(
    (distance, bit, index) => distance + (bit !== b.bits[index] ? 1 : 0),
    0,
  );
}
