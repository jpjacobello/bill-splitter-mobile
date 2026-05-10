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
