"use server";

import {
  type Project,
} from "@prisma/client";
import { db } from "../../../../db";
import type { ProjectItem } from './ProjectDetailPage';

export async function saveProject(id: string, project: Omit<Project, 'cutlistItems'>, cutlistItems: ProjectItem[], { ctx }) {

  await db.project.findFirstOrThrow({
    where: {
      id,
      userId: ctx.user.id
    }
  })

  const data: Project = {
    ...project,
    cutlistItems: JSON.stringify(cutlistItems),
  }

  await db.project.upsert({
    create: data,
    update: data,
    where: {
      id,
    }
  })
}
