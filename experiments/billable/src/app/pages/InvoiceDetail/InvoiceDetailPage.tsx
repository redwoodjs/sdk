"use server";

import React, { Suspense } from "react";
import { Layout } from "../Layout";


import { FetchInvoice } from "./FetchInvoice";
import { InvoiceForm } from "./InvoiceForm";



export default async function InvoiceDetailPage({ id }: { id: string }) {
  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="space-y-12">
          <div className="border-b border-gray-900/10 pb-12">
            <h2 className="text-2xl font-semibold leading-7 text-gray-900">
              Invoice Details
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Create or edit an invoice by filling out the information below.
            </p>

            <Suspense fallback={<div>Loading...</div>}>
              <FetchInvoice id={id}>
                {(invoice: any) => <InvoiceForm invoice={invoice} />}
              </FetchInvoice>
            </Suspense>
          </div>
        </div>
      </div>
    </Layout>
  );
}
