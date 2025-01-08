import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  //

  db.invoice.create({
    data: {
      number: "1" , customer: "Acme Corp", supplier: "Global Supplies Ltd",
    }
  })

  // db.invoice.createMany({
  //   data: [
  //     {


  //     },
  //     {
  //       number: "2",
  //       customer: "TechStart Inc",
  //       supplier: "Industrial Solutions Co",
  //     },
  //     {
  //       number: "3",
  //       customer: "Green Energy Systems",
  //       supplier: "Parts & Components Inc",
  //     },
  //     {
  //       number: "4",
  //       customer: "BuildRight Construction",
  //       supplier: "Equipment Depot LLC",
  //     },
  //   ],
  // });
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
