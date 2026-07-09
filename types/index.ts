export type Person = {
  id: string;
  name: string;
  isHost: boolean;

};

export type ReceiptItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unitPrice?: number; // set by OCR; if present, price = unitPrice * quantity
  assignedTo: string[]; // person ids
  tags?: ('drink' | 'food' | 'shared')[]; // optional categorization
  parentId?: string; // set when this item is a modifier/add-on of another item
};

export type Receipt = {
  merchantName?: string;
  date?: string; // ISO string if available
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  fees: number; // surcharges, admin fees, CC fees — always split proportionally
  tip: number;
  total: number;
  tipIsFromReceipt: boolean;
};

export type PersonBreakdown = {
  person: Person;
  assignedItems: { item: ReceiptItem; share: number }[];
  subtotal: number;   // sum of item shares
  taxShare: number;   // proportional tax
  feesShare: number;  // proportional fees (surcharges, CC fees, etc.)
  tipShare: number;   // proportional tip
  totalOwed: number;  // subtotal + taxShare + feesShare + tipShare
};

export type SplitSummary = {
  people: PersonBreakdown[];
  receiptTotal: number;       // original receipt total
  calculatedTotal: number;    // sum of all totalOwed
  reconciles: boolean;        // within $0.05 of receiptTotal
  unassignedItems: ReceiptItem[];
};

export type BillHistoryEntry = {
  id: string;
  merchantName?: string;
  people: Person[];
  receipt: Receipt;
  receiptImageUri?: string;
  createdAt: string; // ISO string
};

export type SavedGroup = {
  id: string;
  name: string;
  memberIds: string[]; // references TrackedPerson ids in the People roster
};

export type Claim = {
  itemId: string;
  claimerName: string;
  fraction: number; // 1.0 = full item, 0.5 = half, etc.
  claimedAt: string; // ISO string
};

export type BillSession = {
  id: string;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
  merchantName: string;
  creatorName: string;
  creatorVenmoHandle: string;
  receipt: Receipt;
  claims: Record<string, Claim>;
  status: 'open' | 'closed';
  splitType?: 'equal' | 'itemized'; // 'equal' = Quick Split flat per-head; default itemized
  peopleCount?: number; // headcount for equal splits (flat share = total / peopleCount)
  currency?: string; // ISO code (e.g. 'USD', 'EUR') — how the recipient formats amounts
};
