import * as THREE from "three";

/**
 * Boosts the faint Lawrence (2022) WEH alpha mask into a vivid cyan-blue
 * overlay so hydrogen concentrations remain clearly visible on the Moon.
 */
export function buildVividWehCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.drawImage(source, 0, 0, width, height);
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;

  for (let i = 0; i < data.length; i += 4) {
    const rawAlpha = data[i + 3];
    if (rawAlpha === 0) continue;

    // Reduce transparency while keeping the original RGB color values untouched.
    data[i + 3] = Math.min(
      245,
      Math.round(Math.pow(rawAlpha / 255, 0.5) * 240),
    );
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function createVividWehTexture(
  image: HTMLImageElement,
): THREE.CanvasTexture {
  const canvas = buildVividWehCanvas(
    image,
    image.naturalWidth || 720,
    image.naturalHeight || 360,
  );
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
