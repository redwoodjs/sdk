"use server";

import { db } from "../../../../db";
import { getContext } from "../../../../worker";

// We need to pass the context to these somehow?
export async function createProject({
  appContext,
}: {
  appContext: Awaited<ReturnType<typeof getAppContext>>;
}) {
  const userId = appContext.user.id;

  const newProject = await db.project.create({
    data: {
      title: "New Project",
      cutlistItems: JSON.stringify([]),
      userId,
      total: 0,
      currency: "ZAR",
      boardWidth: 1220,
      boardLength: 2440,
      boardPrice: 0,
      bladeWidth: 3,
    },
  });

  return newProject;
}

export async function deleteProject(id: string) {
  await db.project.deleteMany({
    where: { id },
  });
}
