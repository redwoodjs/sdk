import { InvoiceTaxItem, type InvoiceItem } from "@prisma/client";

export function calculateSubtotal(items: InvoiceItem[]) {
  let sum = 0;
  for (const item of items) {
    sum += item.quantity * item.price;
  }
  return sum;
}

export function calculateTaxes(subtotal: number, taxes: InvoiceTaxItem[]) {
  let sum = 0;
  for (const tax of taxes) {
    sum += subtotal * tax.amount;
  }
  return sum;
}
