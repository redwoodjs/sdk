"use server";

import { Layout } from "../../Layout";
import { ProjectForm } from "./ProjectForm";
import { RouteContext } from "../../../../lib/router";
import { db } from "../../../../db";
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "src/components/ui/breadcrumb";
import { link } from "src/shared/links";
import { Project } from "@prisma/client";

export type ProjectItem = {
  width: number;
  length: number;
  quantity: number;
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

export async function updateProject(id: string, data: Partial<Omit<Project, 'userId' | 'cutlistItems'>>) {
  return await db.project.update({
    where: { id },
    data
  });
}

export default async function ProjectDetailPage({
  params,
  ctx,
}: RouteContext<{ id: string }>) {
  const project = await getProject(params.id, ctx.user.id);

  return (
    <Layout ctx={ctx}>
      <BreadcrumbList>
        <BreadcrumbLink href={link('/project/list')}>
        Projects
        </BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbPage>
        Edit Project
        </BreadcrumbPage>
      </BreadcrumbList>

        <ProjectForm project={project} />
    </Layout>
  );
}
