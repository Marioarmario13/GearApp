import "server-only";
import { isAllowedPhotoType, type PhotoMimeType } from "@gearhead/shared";
import sharp from "sharp";

/** Mesmo limite do app (expo-image-manipulator): lado maior em pixels. */
export const MAX_PHOTO_SIDE = 1600;

export class InvalidImageError extends Error {
  constructor() {
    super("Arquivo de imagem inválido.");
    this.name = "InvalidImageError";
  }
}

/**
 * Reprocessa a foto antes de ir para o Storage: aplica a rotação do EXIF, limita o tamanho
 * e regrava a imagem SEM metadados (EXIF, GPS, XMP, ICC — o sharp não os copia por padrão).
 * O formato original é mantido para não perder transparência de PNG/WebP.
 */
export async function sanitizePhoto(
  input: ArrayBuffer,
  contentType: string,
): Promise<{ body: ArrayBuffer; contentType: PhotoMimeType }> {
  if (!isAllowedPhotoType(contentType)) throw new InvalidImageError();
  let pipeline = sharp(Buffer.from(input), { failOn: "error" }).rotate().resize({
    width: MAX_PHOTO_SIDE,
    height: MAX_PHOTO_SIDE,
    fit: "inside",
    withoutEnlargement: true,
  });
  pipeline =
    contentType === "image/jpeg"
      ? pipeline.jpeg({ quality: 85, mozjpeg: true })
      : contentType === "image/png"
        ? pipeline.png()
        : pipeline.webp({ quality: 85 });
  try {
    const out = await pipeline.toBuffer();
    return {
      body: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer,
      contentType,
    };
  } catch {
    throw new InvalidImageError();
  }
}
