import { db } from '../db';
import { defineScript } from './defineScript';

export default defineScript(async () => {
  await db.$queryRaw`
INSERT INTO User (id, email) VALUES (1, 'peterp@example.org') ON CONFLICT DO NOTHING;

INSERT INTO Invoice (id, userId, number, customer, supplierName, supplierContact, notesA) VALUES (1, 1, '1', 'Acme Corp', 'Global Supplies Ltd', '123 Business Ave, Suite 400, Metro City, ST 12345', 'Bank account number 123-456-789, SWIFT: BKCHCNBJ110, IBAN: GB29 NWBK 6016 1331 9268 19');

INSERT INTO InvoiceItem (id, invoiceId, description, price, quantity) VALUES (1, 1, 'Professional Web Development Services', 1200.00, 1);
INSERT INTO InvoiceItem (id, invoiceId, description, price, quantity) VALUES (2, 1, 'UI/UX Design Package', 800.00, 1);
INSERT INTO InvoiceItem (id, invoiceId, description, price, quantity) VALUES (3, 1, 'Server Hosting (Monthly)', 99.99, 12);
INSERT INTO InvoiceItem (id, invoiceId, description, price, quantity) VALUES (4, 1, 'Technical Support Hours', 75.00, 10);

INSERT INTO InvoiceTaxItem (id, invoiceId, description, amount) VALUES (1, 1, 'VAT', 0.14);
  `
  console.log('Done seeding!')
})