"use server";

import { getInvoice } from "../../services/invoices";

// note(peterp, 2025-01-14): I hate this.
export async function FetchInvoice(props: { id: string, children: Function }) {
  const invoice = await getInvoice(props.id);
  return props.children(invoice)
}
