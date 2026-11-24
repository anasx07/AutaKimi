import { describe, it, expect } from "vitest";
import {
  AMBIENT_SAMPLE_WIDTH,
  AMBIENT_SAMPLE_HEIGHT,
  extractAmbientPaletteFromPixels,
  buildAmbientGradientStyle,
} from "../apps/desktop/src/renderer/src/shared/lib/ambientColors";

function createBuffer(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number, number],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y);
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return data;
}

describe("ambientColors", () => {
  it("extracts directional left/right/center dominant colors from 16x9 pixel buffer while ignoring letterbox black", () => {
    const pixels = createBuffer(
      AMBIENT_SAMPLE_WIDTH,
      AMBIENT_SAMPLE_HEIGHT,
      (x, y) => {
        // Top & bottom black letterbox bars
        if (y === 0 || y === AMBIENT_SAMPLE_HEIGHT - 1) return [5, 5, 5, 255];
        // Left side crimson red, right side vibrant ocean blue
        return x < AMBIENT_SAMPLE_WIDTH / 2
          ? [220, 40, 60, 255]
          : [35, 130, 235, 255];
      },
    );

    const palette = extractAmbientPaletteFromPixels(
      pixels,
      AMBIENT_SAMPLE_WIDTH,
      AMBIENT_SAMPLE_HEIGHT,
    );

    // Left should lean strongly red (R > B), right should lean strongly blue (B > R)
    const leftRgb = palette.left.match(/\d+/g)!.map(Number);
    const rightRgb = palette.right.match(/\d+/g)!.map(Number);

    expect(leftRgb[0]).toBeGreaterThan(leftRgb[2]);
    expect(rightRgb[2]).toBeGreaterThan(rightRgb[0]);
    expect(palette.center).toMatch(/^rgb\(\d+, \d+, \d+\)$/);

    const gradient = buildAmbientGradientStyle(palette);
    expect(gradient).toContain(palette.left);
    expect(gradient).toContain(palette.right);
    expect(gradient).toContain(palette.center);
  });

  it("gracefully handles dark monochrome buffers without NaN", () => {
    const pixels = createBuffer(
      AMBIENT_SAMPLE_WIDTH,
      AMBIENT_SAMPLE_HEIGHT,
      () => [12, 12, 12, 255],
    );

    const palette = extractAmbientPaletteFromPixels(
      pixels,
      AMBIENT_SAMPLE_WIDTH,
      AMBIENT_SAMPLE_HEIGHT,
    );

    expect(palette.left).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(palette.center).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(palette.right).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });
});
