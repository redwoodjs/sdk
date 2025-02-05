import { getProject, ProjectItem, updateProject } from "./ProjectDetailPage";
import { RouteContext } from "../../../../lib/router";
import { BreadcrumbLink } from "src/components/ui/breadcrumb";
import { BreadcrumbSeparator } from "src/components/ui/breadcrumb";
import { BreadcrumbPage } from "src/components/ui/breadcrumb";
import { Layout } from "src/pages/Layout";
import { ProjectForm } from "./ProjectForm";
import { BreadcrumbList } from "src/components/ui/breadcrumb";
import { link } from "src/shared/links";
import { calculateBoards } from "./functions";
import { useEffect, useState } from "react";
import { BoardRenderer } from "./BoardRenderer";

export default async function CutlistDetailPage({
    params,
    ctx,
  }: RouteContext<{ id: string }>) {
    const project = await getProject(params.id, ctx.user.id);
    const cutlistItems = JSON.parse(project.cutlistItems as string) as ProjectItem[];
    const { boards, boardCount, totalCost } = calculateBoards(
      cutlistItems,
      project.boardWidth, 
      project.boardLength, 
      project.boardPrice, 
      project.bladeWidth
    );

    // lets update the project with the boards needed and price if not 0
    if (boardCount > 0 && totalCost > 0) {
      await updateProject(params.id, {
        boardsNeeded: boardCount,
        total: totalCost
      });
    }

    return (
      <Layout ctx={ctx}>
        <BreadcrumbList>
          <BreadcrumbLink href={link('/project/list')}>Projects</BreadcrumbLink>
          <BreadcrumbSeparator />
          <BreadcrumbLink href={`/project/${params.id}`}>Edit Project</BreadcrumbLink>
          <BreadcrumbSeparator />
          <BreadcrumbPage>Cutlist</BreadcrumbPage>
        </BreadcrumbList>

        <p id="boardCount">Boards needed: {boardCount}</p>
        <p id="totalCost">Total Cost: ${totalCost}</p>

        <BoardRenderer 
          boards={boards} 
          boardWidth={project.boardWidth} 
          boardHeight={project.boardLength} 
        />
      </Layout>
    );
}
