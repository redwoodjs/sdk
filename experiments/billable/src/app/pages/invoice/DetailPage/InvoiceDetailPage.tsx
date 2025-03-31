"use server";

import { Layout } from "../../Layout";

import { InvoiceForm } from "./InvoiceForm";
import { db } from "src/db";
import { RouteOptions } from "@redwoodjs/sdk/router";
import {
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "src/components/ui/breadcrumb";
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

export type InvoiceLabels = {
  invoiceNumber: string;
  invoiceDate: string;
  itemDescription: string;
  itemQuantity: string;
  itemPrice: string;
  subtotal: string;
  total: string;
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
    labels: JSON.parse(invoice.labels || "{}") as InvoiceLabels,
  };
}

export async function InvoiceDetailPage({
  params,
  appContext,
}: RouteOptions<{ id: string }>) {
  const invoice = await getInvoice(params.id, appContext.user.id);

  return (
    <Layout appContext={appContext}>
      <BreadcrumbList>
        <BreadcrumbLink href={link("/invoice/list")}>Invoices</BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbPage>Edit Invoice</BreadcrumbPage>
      </BreadcrumbList>

      <InvoiceForm invoice={invoice} appContext={appContext} />
    </Layout>
  );
}
