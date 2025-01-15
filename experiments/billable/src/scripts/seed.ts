import { db } from '../db';
import { defineScript } from './defineScript';

export default defineScript(async () => {
  await db.$queryRaw`
DELETE FROM Invoice;
DELETE FROM User;
DELETE FROM sqlite_sequence;


INSERT INTO User (id, email) VALUES (1, 'peterp@example.org');
INSERT INTO Invoice (id, userId, number, customer, supplierName, supplierContact, notesA, items, taxes) VALUES (1, 1, '1', 'Acme Corp', 'Global Supplies Ltd', '123 Business Ave, Suite 400, Metro City, ST 12345', 'Bank account number 123-456-789, SWIFT: BKCHCNBJ110, IBAN: GB29 NWBK 6016 1331 9268 19', '[{"description": "Professional Web Development Services", "price": 1200.00, "quantity": 1}, {"description": "UI/UX Design Package", "price": 800.00, "quantity": 1}, {"description": "Server Hosting (Monthly)", "price": 99.99, "quantity": 12}, {"description": "Technical Support Hours", "price": 75.00, "quantity": 10}]', '[{"description": "VAT", "amount": 0.14}]');
INSERT INTO Invoice (id, userId, number, customer, supplierName, supplierContact, notesA, items, taxes) VALUES (2, 1, '2', 'TechStart Inc', 'Global Supplies Ltd', '123 Business Ave, Suite 400, Metro City, ST 12345', 'Bank account number 123-456-789, SWIFT: BKCHCNBJ110', '[{"description": "Mobile App Development", "price": 3500.00, "quantity": 1}, {"description": "Cloud Infrastructure Setup", "price": 1200.00, "quantity": 1}]', '[{"description": "VAT", "amount": 0.15}, {"description": "City Tax", "amount": 0.02}]');
INSERT INTO Invoice (id, userId, number, customer, supplierName, supplierContact, notesA, items, taxes) VALUES (3, 1, '3', 'Marketing Masters LLC\nAttn: John Smith\n555 Commerce St\nBusiness City, BZ 54321', 'Global Supplies Ltd', '123 Business Ave, Suite 400, Metro City, ST 12345', NULL, '[{"description": "Digital Marketing Campaign", "price": 2500.00, "quantity": 1}, {"description": "Social Media Management", "price": 800.00, "quantity": 3}, {"description": "Content Creation", "price": 450.00, "quantity": 5}]', '[{"description": "VAT", "amount": 0.14}]');
INSERT INTO Invoice (id, userId, number, customer, supplierName, supplierContact, notesA, items, taxes) VALUES (4, 1, '4', 'Healthcare Solutions Corp', 'Global Supplies Ltd', '123 Business Ave, Suite 400, Metro City, ST 12345', 'Payment due within 30 days', '[{"description": "Medical Software License", "price": 5000.00, "quantity": 1}, {"description": "Staff Training", "price": 1200.00, "quantity": 2}, {"description": "Support Package", "price": 299.99, "quantity": 12}]', '[{"description": "VAT", "amount": 0.14}, {"description": "Service Tax", "amount": 0.03}]');
  `
  console.log('Done seeding!')
})
