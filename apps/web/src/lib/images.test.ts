// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { InvalidImageError, MAX_PHOTO_SIDE, sanitizePhoto } from "./images";

vi.mock("server-only", () => ({}));

async function photoWithGps(format: "jpeg" | "png" | "webp", width = 3000, height = 2000) {
  const buf = await sharp({ create: { width, height, channels: 3, background: "#c33" } })
    .withExif({
      IFD0: { Make: "Celular" },
      IFD3: { GPSLatitudeRef: "S", GPSLatitude: "25/1 25/1 0/1" },
    })
    .withMetadata({ orientation: 6 })
    [format]()
    .toBuffer();
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe("sanitizePhoto", () => {
  it.each(["jpeg", "png", "webp"] as const)(
    "remove EXIF/GPS de %s e limita o tamanho",
    async (f) => {
      const original = await photoWithGps(f);
      expect((await sharp(Buffer.from(original)).metadata()).exif).toBeDefined();

      const { body, contentType } = await sanitizePhoto(original, `image/${f}`);
      const meta = await sharp(Buffer.from(body)).metadata();
      expect(contentType).toBe(`image/${f}`);
      expect(meta.format).toBe(f);
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(Math.max(meta.width, meta.height)).toBe(MAX_PHOTO_SIDE);
    },
  );

  it("aplica a rotação do EXIF antes de descartá-lo", async () => {
    const { body } = await sanitizePhoto(await photoWithGps("jpeg", 400, 200), "image/jpeg");
    const meta = await sharp(Buffer.from(body)).metadata();
    expect([meta.width, meta.height, meta.orientation]).toEqual([200, 400, undefined]);
  });

  it("recusa tipo não permitido ou arquivo corrompido", async () => {
    const junk = new TextEncoder().encode("não sou uma imagem").buffer as ArrayBuffer;
    await expect(sanitizePhoto(junk, "image/jpeg")).rejects.toBeInstanceOf(InvalidImageError);
    await expect(sanitizePhoto(await photoWithGps("png"), "image/gif")).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });
});
