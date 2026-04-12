import { Person, Receipt, SplitSummary } from '../types';

export const mockPeople: Person[] = [
  { id: 'host', name: 'JP', isHost: true },
  { id: '2', name: 'Alex', isHost: false },
  { id: '3', name: 'Sara', isHost: false },
];

export const mockReceipt: Receipt = {
  merchantName: 'Osteria Italiana',
  date: '2026-03-31',
  items: [
    { id: '1', name: 'Margherita Pizza', price: 18.0, quantity: 1, unitPrice: 18.0, assignedTo: [], tags: ['food'] },
    { id: '2', name: 'Caesar Salad', price: 12.5, quantity: 1, unitPrice: 12.5, assignedTo: [], tags: ['food'] },
    { id: '3', name: 'Pasta Carbonara', price: 22.0, quantity: 1, unitPrice: 22.0, assignedTo: [], tags: ['food'] },
    { id: '4', name: 'Sparkling Water', price: 4.0, quantity: 2, unitPrice: 2.0, assignedTo: [], tags: ['drink'] },
    { id: '5', name: 'Tiramisu', price: 9.0, quantity: 1, unitPrice: 9.0, assignedTo: [], tags: ['food'] },
  ],
  subtotal: 65.5,
  tax: 5.9,
  fees: 0,
  tip: 13.1,
  total: 84.5,
  tipIsFromReceipt: true,
};
