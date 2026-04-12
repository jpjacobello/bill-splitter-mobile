import { create } from 'zustand';
import { Person, Receipt, ReceiptItem } from '../types';

export type { Person, Receipt, ReceiptItem };

type BillStore = {
  hostName: string;
  people: Person[];
  receipt: Receipt | null;
  pendingImageUri: string | null;
  receiptImageUri: string | null;

  // Host + people
  setHostName: (name: string) => void;
  addPerson: (name: string) => void;
  removePerson: (id: string) => void;

  // Receipt
  setPendingImageUri: (uri: string | null) => void;
  setReceiptImageUri: (uri: string | null) => void;
  setReceipt: (receipt: Receipt) => void;
  updateReceiptField: (field: 'subtotal' | 'tax' | 'fees' | 'tip' | 'total', value: number) => void;

  // Items
  addItem: (item: Omit<ReceiptItem, 'id' | 'assignedTo'>) => void;
  updateItem: (id: string, updates: Partial<ReceiptItem>) => void;
  deleteItem: (id: string) => void;

  // Splitting
  assignItem: (itemId: string, personIds: string[]) => void;
  splitItemEvenly: (itemId: string) => void; // assign to all people
  splitIntoIndividualUnits: (itemId: string) => void; // quantity > 1 → separate items

  // Tip
  updateTip: (tip: number) => void;

  // Session
  reset: () => void;
};

export const useBillStore = create<BillStore>((set, get) => ({
  hostName: '',
  people: [],
  receipt: null,
  pendingImageUri: null,
  receiptImageUri: null,

  setPendingImageUri: (uri) => set({ pendingImageUri: uri }),
  setReceiptImageUri: (uri) => set({ receiptImageUri: uri }),

  setHostName: (name) =>
    set((state) => ({
      hostName: name,
      people: [
        { id: 'host', name, isHost: true },
        ...state.people.filter((p) => !p.isHost),
      ],
    })),

  addPerson: (name) =>
    set((state) => ({
      people: [
        ...state.people,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, isHost: false },
      ],
    })),

  removePerson: (id) =>
    set((state) => ({
      people: state.people.filter((p) => p.id !== id),
      // unassign this person from all items
      receipt: state.receipt
        ? {
            ...state.receipt,
            items: state.receipt.items.map((item) => ({
              ...item,
              assignedTo: item.assignedTo.filter((pid) => pid !== id),
            })),
          }
        : null,
    })),

  setReceipt: (receipt) => set({ receipt }),

  updateReceiptField: (field, value) =>
    set((state) => ({
      receipt: state.receipt ? { ...state.receipt, [field]: value } : null,
    })),

  addItem: (item) =>
    set((state) => ({
      receipt: state.receipt
        ? {
            ...state.receipt,
            items: [
              ...state.receipt.items,
              { ...item, id: Date.now().toString(), assignedTo: [] },
            ],
          }
        : null,
    })),

  updateItem: (id, updates) =>
    set((state) => ({
      receipt: state.receipt
        ? {
            ...state.receipt,
            items: state.receipt.items.map((item) =>
              item.id === id ? { ...item, ...updates } : item
            ),
          }
        : null,
    })),

  deleteItem: (id) =>
    set((state) => ({
      receipt: state.receipt
        ? {
            ...state.receipt,
            items: state.receipt.items.filter((item) => item.id !== id),
          }
        : null,
    })),

  assignItem: (itemId, personIds) =>
    set((state) => ({
      receipt: state.receipt
        ? {
            ...state.receipt,
            items: state.receipt.items.map((item) =>
              item.id === itemId ? { ...item, assignedTo: personIds } : item
            ),
          }
        : null,
    })),

  splitItemEvenly: (itemId) => {
    const { people, receipt } = get();
    if (!receipt) return;
    const allIds = people.map((p) => p.id);
    set((state) => ({
      receipt: state.receipt
        ? {
            ...state.receipt,
            items: state.receipt.items.map((item) =>
              item.id === itemId ? { ...item, assignedTo: allIds } : item
            ),
          }
        : null,
    }));
  },

  // Expands a qty > 1 item into individual single-unit items
  splitIntoIndividualUnits: (itemId) =>
    set((state) => {
      if (!state.receipt) return {};
      const item = state.receipt.items.find((i) => i.id === itemId);
      if (!item || item.quantity <= 1) return {};

      const unitPrice = item.price / item.quantity;
      const newItems: ReceiptItem[] = Array.from({ length: item.quantity }, (_, i) => ({
        id: `${itemId}-unit-${i + 1}`,
        name: `${item.name} (${i + 1})`,
        price: unitPrice,
        quantity: 1,
        assignedTo: [],
        tags: item.tags,
      }));

      return {
        receipt: {
          ...state.receipt,
          items: [
            ...state.receipt.items.filter((i) => i.id !== itemId),
            ...newItems,
          ],
        },
      };
    }),

  updateTip: (tip) =>
    set((state) => ({
      receipt: state.receipt ? { ...state.receipt, tip } : null,
    })),

  reset: () => set({ hostName: '', people: [], receipt: null, pendingImageUri: null, receiptImageUri: null }),
}));
