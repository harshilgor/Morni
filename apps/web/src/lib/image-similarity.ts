export type ImageFingerprint = { bits: number[]; meanRgb: [number, number, number]; hueHistogram: number[]; meanSaturation: number };

export async function fingerprintImage(file: File): Promise<ImageFingerprint> {
  const bitmap = await createImageBitmap(file);
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not inspect image.");
  context.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  const pixels = context.getImageData(0, 0, size, size).data;
  const luminance: number[] = [];
  const meanRgb: [number, number, number] = [0, 0, 0];
  const hueHistogram = Array.from({ length: 12 }, () => 0);
  let meanSaturation = 0;
  let chromaticPixels = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] / 255;
    const green = pixels[index + 1] / 255;
    const blue = pixels[index + 2] / 255;
    meanRgb[0] += red; meanRgb[1] += green; meanRgb[2] += blue;
    luminance.push(0.299 * red + 0.587 * green + 0.114 * blue);
    const max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min;
    const saturation = max === 0 ? 0 : delta / max;
    meanSaturation += saturation;
    if (saturation > 0.18 && delta > 0.08) {
      let hue = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
      if (hue < 0) hue += 6;
      hueHistogram[Math.min(11, Math.floor((hue / 6) * 12))] += 1;
      chromaticPixels += 1;
    }
  }
  const pixelCount = pixels.length / 4;
  meanRgb[0] /= pixelCount; meanRgb[1] /= pixelCount; meanRgb[2] /= pixelCount;
  meanSaturation /= pixelCount;
  if (chromaticPixels) for (let index = 0; index < hueHistogram.length; index += 1) hueHistogram[index] /= chromaticPixels;
  const average =
    luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  return {
    bits: luminance.map((value) => (value >= average ? 1 : 0)), meanRgb, hueHistogram, meanSaturation,
  };
}

export function colorDistance(a: ImageFingerprint, b: ImageFingerprint) {
  const rgb = Math.sqrt(a.meanRgb.reduce((total, value, index) => total + (value - b.meanRgb[index]) ** 2, 0) / 3);
  const hue = a.hueHistogram.reduce((total, value, index) => total + Math.abs(value - b.hueHistogram[index]), 0) / 2;
  return rgb * 0.55 + hue * 0.3 + Math.abs(a.meanSaturation - b.meanSaturation) * 0.15;
}

export function fingerprintDistance(a: ImageFingerprint, b: ImageFingerprint) {
  return a.bits.reduce(
    (distance, bit, index) => distance + (bit !== b.bits[index] ? 1 : 0),
    0,
  );
}
