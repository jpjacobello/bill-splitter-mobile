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
  members: string[]; // display names only (no host)
};
