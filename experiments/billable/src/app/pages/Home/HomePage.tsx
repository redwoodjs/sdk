import { RouteContext } from '@redwoodjs/reloaded/worker';
import { Layout } from "../Layout";
import { InvoiceForm } from "../invoice/DetailPage/InvoiceForm";
export default function HomePage({ ctx }: RouteContext) {
  // We will make the invoice save to a local database.
  return (
    <Layout ctx={ctx}>
      <InvoiceForm
        invoice={{
          items: [{
            quantity: 1,
            price: 1,
          }],
          taxes: [],
          labels: {},
          date: new Date(),
          invoiceNumber: "1",
        }}
        ctx={ctx}
      />
    </Layout>
  );
}
