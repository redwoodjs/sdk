import { RouteContext } from "@redwoodjs/reloaded/router";
import { InteriorLayout } from "app/layouts/InteriorLayout";

export async function DetailPage({ params, ctx }: RouteContext<{ id: string }>) {
  const { id } = params
  return (
    <InteriorLayout>
      <h1 className="text-4xl text-red-500">Applications List</h1>
      {id}
    </InteriorLayout>
  );
}
