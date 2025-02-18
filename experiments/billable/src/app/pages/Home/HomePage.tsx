import { RouteContext } from '@redwoodjs/sdk/worker';
import { Layout } from "../Layout";
import { InvoiceForm } from "../invoice/DetailPage/InvoiceForm";
export default function HomePage({ ctx }: RouteContext) {
  return (
    <Layout ctx={ctx}>
      <InvoiceForm
        invoice={{
          items: [{
            description: "",
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
