import { requireOptionalNativeModule } from 'expo-modules-core';

export type PickedContact = { id: string; name: string; phone?: string };

const ContactPicker = requireOptionalNativeModule('ContactPicker');

// Native iOS multi-select via CNContactPickerViewController's array delegate.
// Returns the contacts the user checked (empty if cancelled / unavailable).
// The system picker is privacy-preserving — no contacts permission required.
export async function presentMultiContactPickerAsync(): Promise<PickedContact[]> {
  if (!ContactPicker) return [];
  const raw: { id: string; name: string; phone: string }[] =
    await ContactPicker.presentMultiContactPicker();
  return raw.map((c) => ({ id: c.id, name: c.name || 'Unknown', phone: c.phone || undefined }));
}
