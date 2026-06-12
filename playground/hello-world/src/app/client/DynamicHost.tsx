"use client";

import { lazy, Suspense } from "react";

const DynamicTarget = lazy(() => import("./DynamicTarget"));

export function DynamicHost() {
  return (
    <Suspense fallback={<p data-proof="dynamic-loading">Loading dynamic client import</p>}>
      <DynamicTarget />
    </Suspense>
  );
}
