"use server";

import { getInvoice } from "../../services/invoices";

export async function FetchInvoice(props: { id: string, children: Function }) {
  const invoice = await getInvoice(props.id);
  return props.children(invoice)
}
