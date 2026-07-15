import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Person, Receipt, ReceiptItem } from '../types';

export type { Person, Receipt, ReceiptItem };

type BillStore = {
  hostName: string;
  paidById: string;
  people: Person[];
  receipt: Receipt | null;
  pendingImageUri: string | null;
  receiptImageUri: string | null;
  activeSessionId: string | null;

  // Host + people
  setHostName: (name: string) => void;
  setPaidById: (id: string) => void;
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
  splitItemEvenly: (itemId: string) => void;
  splitIntoIndividualUnits: (itemId: string) => void;
  consolidateLikeItems: (itemId: string) => void; // merge all items sharing the same base name

  // Tip
  updateTip: (tip: number) => void;

  // Session
  setActiveSessionId: (id: string | null) => void;
  reset: () => void;
};

export const useBillStore = create<BillStore>()(persist((set, get) => ({
  hostName: '',
  paidById: 'host',
  people: [],
  receipt: null,
  pendingImageUri: null,
  receiptImageUri: null,
  activeSessionId: null,

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

  setPaidById: (id) => set({ paidById: id }),

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
      paidById: state.paidById === id ? 'host' : state.paidById,
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
            items: state.receipt.items
              .filter((item) => item.id !== id)
              .map((item) => (item.parentId === id ? { ...item, parentId: undefined } : item)),
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

      // Re-parent any add-ons of the original item to the first new unit
      const firstNewId = newItems[0].id;
      const remainingItems = state.receipt.items
        .filter((i) => i.id !== itemId)
        .map((i) => (i.parentId === itemId ? { ...i, parentId: firstNewId } : i));

      return {
        receipt: {
          ...state.receipt,
          items: [...remainingItems, ...newItems],
        },
      };
    }),

  consolidateLikeItems: (itemId) =>
    set((state) => {
      if (!state.receipt) return {};
      const target = state.receipt.items.find((i) => i.id === itemId);
      if (!target) return {};
      const baseName = target.name.replace(/\s*\(\d+\)\s*$/, '').trim();
      const likeItems = state.receipt.items.filter(
        (i) => i.name.replace(/\s*\(\d+\)\s*$/, '').trim() === baseName
      );
      if (likeItems.length <= 1) return {};
      const totalQty = likeItems.reduce((s, i) => s + i.quantity, 0);
      const totalPrice = parseFloat(likeItems.reduce((s, i) => s + i.price, 0).toFixed(2));
      const allAssigned = [...new Set(likeItems.flatMap((i) => i.assignedTo))];
      const consolidated: ReceiptItem = {
        id: likeItems[0].id,
        name: baseName,
        quantity: totalQty,
        price: totalPrice,
        unitPrice: parseFloat((totalPrice / totalQty).toFixed(4)),
        assignedTo: allAssigned,
        tags: target.tags,
      };
      const likeIds = new Set(likeItems.map((i) => i.id));
      const consolidatedId = likeItems[0].id;
      const newItems = state.receipt.items.reduce<ReceiptItem[]>((acc, item) => {
        if (!likeIds.has(item.id)) return [...acc, item];
        if (item.id === consolidatedId) return [...acc, consolidated];
        return acc;
      }, []);
      // Re-parent any add-ons of removed like items to the consolidated item
      const fixedItems = newItems.map((item) =>
        item.parentId && likeIds.has(item.parentId) && item.parentId !== consolidatedId
          ? { ...item, parentId: consolidatedId }
          : item
      );
      return { receipt: { ...state.receipt, items: fixedItems } };
    }),

  updateTip: (tip) =>
    set((state) => ({
      receipt: state.receipt ? { ...state.receipt, tip } : null,
    })),

  setActiveSessionId: (id) => set({ activeSessionId: id }),

  reset: () => set({ hostName: '', paidById: 'host', people: [], receipt: null, pendingImageUri: null, receiptImageUri: null, activeSessionId: null }),
}), {
  name: 'divi-bill-store',
  storage: createJSONStorage(() => AsyncStorage),
  // Only the active session survives a cold launch — so the host's Live Activity
  // keeps updating and ends cleanly after the app is swiped away. Everything else
  // (receipt, people, in-progress edits) must NOT resurrect stale state.
  partialize: (s) => ({ activeSessionId: s.activeSessionId }),
}));
