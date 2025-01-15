"use server";

import { getInvoice } from "../../services/invoices";

export async function FetchInvoice(props: { id: number, children: Function }) {
  const invoice = await getInvoice(props.id, 1);
  return props.children(invoice)
}
