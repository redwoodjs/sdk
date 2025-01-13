"use server";

import React from "react";
import { getInvoice } from "../../services/invoices";

export function FetchInvoice(props: { id: number, children: Function }) {

  const invoice = React.use(getInvoice(props.id, 1));
  return props.children(invoice)
}

