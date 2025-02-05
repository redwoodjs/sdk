import { getProject, ProjectItem, updateProject } from "./ProjectDetailPage";
import { RouteContext } from "../../../../lib/router";
import { BreadcrumbLink } from "src/components/ui/breadcrumb";
import { BreadcrumbSeparator } from "src/components/ui/breadcrumb";
import { BreadcrumbPage } from "src/components/ui/breadcrumb";
import { Layout } from "src/pages/Layout";
import { BreadcrumbList } from "src/components/ui/breadcrumb";
import { link } from "src/shared/links";
import { calculateBoards } from "./functions";
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

        <div className="grid grid-cols-2 gap-4 mb-6 mt-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Boards Needed
            </h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {boardCount}
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Total Cost
            </h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {project.currency} {totalCost.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Cut Layout
          </h3>
          <BoardRenderer 
            boards={boards} 
            boardWidth={project.boardWidth} 
            boardHeight={project.boardLength} 
          />
        </div>
      </Layout>
    );
}
