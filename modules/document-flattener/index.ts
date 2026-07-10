import { requireOptionalNativeModule } from 'expo-modules-core';

const DocumentFlattener = requireOptionalNativeModule('DocumentFlattener');

export async function flattenDocument(imageUri: string): Promise<string> {
  try {
    if (!DocumentFlattener) return imageUri;
    return await DocumentFlattener.flattenDocument(imageUri);
  } catch {
    return imageUri;
  }
}

// Whiten only (no crop) — for images VisionKit already cropped (camera path).
export async function enhanceDocument(imageUri: string): Promise<string> {
  try {
    if (!DocumentFlattener) return imageUri;
    return await DocumentFlattener.enhanceDocument(imageUri);
  } catch {
    return imageUri;
  }
}
