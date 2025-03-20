import { defineScript } from "@redwoodjs/sdk/worker";
import { db, setupDb } from "../db";

export default defineScript(async ({ env }) => {
  setupDb(env);

  await db.$executeRawUnsafe(`\
    DELETE FROM Invoice;
    DELETE FROM User;
    DELETE FROM sqlite_sequence;
  `);

  const user = await db.user.create({
    data: {
      id: "1",
      email: "peter@redwoodjs.com",
    },
  });

  await db.invoice.create({
    data: {
      userId: user.id,
      number: "1",
      customer: "Acme Corp",
      supplierName: "Global Supplies Ltd",
      supplierContact: "123 Business Ave, Suite 400, Metro City, ST 12345",
      notesA:
        "Bank account number 123-456-789, SWIFT: BKCHCNBJ110, IBAN: GB29 NWBK 6016 1331 9268 19",
      items: JSON.stringify([
        {
          description: "Professional Web Development Services",
          price: 1200.0,
          quantity: 1,
        },
        { description: "UI/UX Design Package", price: 800.0, quantity: 1 },
        { description: "Server Hosting (Monthly)", price: 99.99, quantity: 12 },
        { description: "Technical Support Hours", price: 75.0, quantity: 10 },
      ]),
      taxes: JSON.stringify([{ description: "VAT", amount: 0.14 }]),
      currency: "$",
      createdAt: new Date("2024-01-01T10:00:00Z"),
    },
  });

  await db.invoice.create({
    data: {
      userId: user.id,
      number: "2",
      customer: "TechStart Inc",
      supplierName: "Global Supplies Ltd",
      supplierContact: "123 Business Ave, Suite 400, Metro City, ST 12345",
      notesA: "Bank account number 123-456-789, SWIFT: BKCHCNBJ110",
      items: JSON.stringify([
        { description: "Mobile App Development", price: 3500.0, quantity: 1 },
        {
          description: "Cloud Infrastructure Setup",
          price: 1200.0,
          quantity: 1,
        },
      ]),
      taxes: JSON.stringify([
        { description: "VAT", amount: 0.15 },
        { description: "City Tax", amount: 0.02 },
      ]),
      currency: "$",
      createdAt: new Date("2024-01-02T10:00:00Z"),
    },
  });

  await db.invoice.create({
    data: {
      userId: user.id,
      number: "3",
      customer:
        "Marketing Masters LLC\nAttn: John Smith\n555 Commerce St\nBusiness City, BZ 54321",
      supplierName: "Global Supplies Ltd",
      supplierContact: "123 Business Ave, Suite 400, Metro City, ST 12345",
      items: JSON.stringify([
        {
          description: "Digital Marketing Campaign",
          price: 2500.0,
          quantity: 1,
        },
        { description: "Social Media Management", price: 800.0, quantity: 3 },
        { description: "Content Creation", price: 450.0, quantity: 5 },
      ]),
      taxes: JSON.stringify([{ description: "VAT", amount: 0.14 }]),
      currency: "$",
      createdAt: new Date("2024-01-03T10:00:00Z"),
    },
  });

  await db.invoice.create({
    data: {
      userId: user.id,
      number: "4",
      customer: "Healthcare Solutions Corp",
      supplierName: "Global Supplies Ltd",
      supplierContact: "123 Business Ave, Suite 400, Metro City, ST 12345",
      notesA: "Payment due within 30 days",
      items: JSON.stringify([
        { description: "Medical Software License", price: 5000.0, quantity: 1 },
        { description: "Staff Training", price: 1200.0, quantity: 2 },
        { description: "Support Package", price: 299.99, quantity: 12 },
      ]),
      taxes: JSON.stringify([
        { description: "VAT", amount: 0.14 },
        { description: "Service Tax", amount: 0.03 },
      ]),
      currency: "$",
      createdAt: new Date("2024-01-04T10:00:00Z"),
    },
  });

  console.log("Done seeding!");
});
