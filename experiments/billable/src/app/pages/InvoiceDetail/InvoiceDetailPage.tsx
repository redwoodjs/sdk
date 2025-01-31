"use server";

import { Suspense } from "react";
import { Layout } from "../Layout";

import { InvoiceForm } from "./InvoiceForm";
import { RouteContext } from "../../../router";
import { db } from "../../../db";

export type InvoiceItem = {
  description: string,
  price: number,
  quantity: number,
}

export type InvoiceTaxes = {
  description: string,
  amount: number
}


export async function getInvoice(id: string, userId: string) {

  const invoice =  await db.invoice.findFirstOrThrow({
    where: {
      id,
      userId,
    }
  })

  return {
    ...invoice,
    items: JSON.parse(invoice.items) as InvoiceItem[],
    taxes: JSON.parse(invoice.taxes) as InvoiceTaxes[]
  }
}


export default async function InvoiceDetailPage({ params, ctx }: RouteContext<{ id: string }>) {

  const invoice = await getInvoice(params.id, ctx.user.id)

  return (
    <Layout ctx={ctx}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="space-y-12">
          <div className="border-b border-gray-900/10 pb-12">
            <h2 className="text-2xl font-semibold leading-7 text-gray-900">
              Invoice Details
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Create or edit an invoice by filling out the information below.
            </p>
            <InvoiceForm invoice={invoice} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
