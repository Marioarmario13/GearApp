import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/**
 * Abre a galeria, redimensiona para no máx. 1600 px e converte para JPEG.
 * Converter garante um tipo aceito pelo bucket (HEIC do iPhone não é) e um
 * tamanho bem abaixo de 5 MB. Retorna null se o usuário cancelar.
 */
export async function pickVehiclePhoto(): Promise<{
  body: ArrayBuffer;
  contentType: "image/jpeg";
} | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsMultipleSelection: false,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1600 || asset.width === 0) context.resize({ width: 1600 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

  const body = await (await fetch(saved.uri)).arrayBuffer();
  return { body, contentType: "image/jpeg" };
}
