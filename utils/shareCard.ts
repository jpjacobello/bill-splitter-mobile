import { RefObject } from 'react';
import { View } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

/*
 * shareReceiptImage — capture an off-screen ShareableReceiptCard and hand the
 * PNG to the native share sheet (iMessage, copy, save, etc.).
 *
 * The ref must point at a mounted, laid-out view. Copies to a nicely named
 * cache file so the share sheet shows "<Merchant> <Name>.png"; falls back to
 * the raw capture path if the rename fails. Cancels/failures are swallowed.
 */
export async function shareReceiptImage(
  ref: RefObject<View | null>,
  merchantName?: string,
  personName?: string,
): Promise<void> {
  try {
    const { captureRef } = require('react-native-view-shot');
    const tmpUri = await captureRef(ref, { format: 'png', quality: 1, width: 320 });
    const tmpFile = tmpUri.startsWith('file://') ? tmpUri : `file://${tmpUri}`;

    let shareUri = tmpFile;
    try {
      const merchant = (merchantName ?? 'Receipt').replace(/[^a-zA-Z0-9 ]/g, '').trim();
      const fileName = personName ? `${merchant} ${personName}.png` : `${merchant}.png`;
      const namedUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.deleteAsync(namedUri, { idempotent: true });
      await FileSystem.copyAsync({ from: tmpFile, to: namedUri });
      shareUri = namedUri;
    } catch {
      // rename failed — share the tmp file as-is
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(shareUri, { mimeType: 'image/png', UTI: 'public.png' });
    }
  } catch {
    // ignore cancels / capture failures
  }
}
