'use server';


import { db } from "../../../../db";
import { getContext } from "../../../../worker";



// We need to pass the context to these somehow?
export async function createProject({ ctx }: { ctx: Awaited<ReturnType<typeof getContext>>}) {

  const userId = ctx.user.id

  // todo(peterp, 28-01-2025): Implement templates.
  let lastProject = await db.project.findFirst({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    }
  })

  const newProject = await db.project.create({
    data: {
      title: lastProject?.title || "New Project",
      userId,
      total: 0,
      currency: "ZAR",
      boardWidth: 1220,
      boardLength: 2440,
      boardPrice: 0,
      bladeWidth: 3,
    }
  })

  return newProject
}
