export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export class ImageReadError extends Error {}

export function readImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new ImageReadError(`«${file.name}» — не изображение`));
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return Promise.reject(new ImageReadError(`«${file.name}» весит ${mb} МБ, допустимо до 10 МБ`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new ImageReadError('Не удалось прочитать изображение'));
    });
    reader.addEventListener('error', () => reject(new ImageReadError('Не удалось прочитать изображение')));
    reader.readAsDataURL(file);
  });
}
