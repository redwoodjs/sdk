"use server";

import { Layout } from "../../Layout";
import { ProjectForm } from "./ProjectForm";
import { RouteOptions } from "../../../../lib/router";
import { db } from "../../../../db";
import {
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "src/components/ui/breadcrumb";
import { link } from "src/shared/links";

export type ProjectItem = {
  width: number;
  length: number;
  quantity: number;
};

type Project = {
  id: string;
  title: string;
  total: number;
  boardsNeeded: number;
  createdAt: Date;
};

export async function getProject(id: string, userId: string) {
  const project = await db.project.findFirstOrThrow({
    where: {
      id,
      userId,
    },
  });

  return {
    ...project,
  };
}

export async function updateProject(
  id: string,
  data: Partial<Omit<Project, "userId" | "cutlistItems">>,
) {
  return await db.project.update({
    where: { id },
    data,
  });
}

export default async function ProjectDetailPage({
  params,
  ctx,
}: RouteOptions<{ id: string }>) {
  const project = await getProject(params.id, ctx.user.id);

  return (
    <Layout ctx={ctx}>
      <BreadcrumbList>
        <BreadcrumbLink href={link("/project/list")}>Projects</BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbPage>Edit Project</BreadcrumbPage>
      </BreadcrumbList>

      <ProjectForm project={project} />
    </Layout>
  );
}
