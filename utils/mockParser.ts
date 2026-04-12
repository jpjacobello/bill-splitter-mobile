import { Receipt } from '../types';

// Swap this function out later for a real OCR/Vision API call
export async function parseReceiptFromImage(imageUri: string): Promise<Receipt> {
  // Simulate network delay
  await new Promise((res) => setTimeout(res, 1200));

  return {
    merchantName: 'Osteria Italiana',
    date: new Date().toISOString().split('T')[0],
    items: [
      { id: '1', name: 'Margherita Pizza', price: 18.0, quantity: 1, assignedTo: [] },
      { id: '2', name: 'Caesar Salad', price: 12.5, quantity: 1, assignedTo: [] },
      { id: '3', name: 'Pasta Carbonara', price: 22.0, quantity: 1, assignedTo: [] },
      { id: '4', name: 'Sparkling Water', price: 4.0, quantity: 2, assignedTo: [] },
      { id: '5', name: 'Tiramisu', price: 9.0, quantity: 1, assignedTo: [] },
    ],
    subtotal: 65.5,
    tax: 5.9,
    tip: 13.1,
    total: 84.5,
    tipIsFromReceipt: true,
  };
}
