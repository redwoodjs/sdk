"use server";

import { Layout } from "../../Layout";

import { InvoiceForm } from "./InvoiceForm";
import { RouteContext } from "../../../../lib/router";
import { db } from "../../../../db";
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "src/components/ui/breadcrumb";
import { link } from "src/shared/links";

export type InvoiceItem = {
  description: string;
  price: number;
  quantity: number;
};

export type InvoiceTaxes = {
  description: string;
  amount: number;
};

export async function getInvoice(id: string, userId: string) {
  const invoice = await db.invoice.findFirstOrThrow({
    where: {
      id,
      userId,
    },
  });

  return {
    ...invoice,
    items: JSON.parse(invoice.items) as InvoiceItem[],
    taxes: JSON.parse(invoice.taxes) as InvoiceTaxes[],
  };
}

export default async function InvoiceDetailPage({
  params,
  ctx,
}: RouteContext<{ id: string }>) {
  const invoice = await getInvoice(params.id, ctx.user.id);

  return (
    <Layout ctx={ctx}>
      <BreadcrumbList>
        <BreadcrumbLink href={link('/invoice/list')}>
        Invoices
        </BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbPage>
        Edit Invoice
        </BreadcrumbPage>
      </BreadcrumbList>

      <InvoiceForm invoice={invoice} ctx={ctx} />
    </Layout>
  );
}
