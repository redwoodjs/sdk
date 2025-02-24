import { getProject, ProjectItem, updateProject } from "./ProjectDetailPage";
import { RouteContext } from "@redwoodjs/sdk/router";
import { BreadcrumbLink } from "src/components/ui/breadcrumb";
import { BreadcrumbSeparator } from "src/components/ui/breadcrumb";
import { BreadcrumbPage } from "src/components/ui/breadcrumb";
import { Layout } from "src/pages/Layout";
import { BreadcrumbList } from "src/components/ui/breadcrumb";
import { link } from "src/shared/links";
import { BoardRenderer } from "./BoardRenderer";
import { findOptimalPacking, calculateFreeSpaces } from "./clientFunctions";

export default async function CutlistDetailPage({
  params,
  ctx,
}: RouteContext<{ id: string }>) {
  const project = await getProject(params.id, ctx.user.id);
  const cutlistItems = JSON.parse(project.cutlistItems as string) as ProjectItem[];

  const SHEET_WIDTH = project.boardWidth;
  const SHEET_HEIGHT = project.boardLength;
  const BLADE_WIDTH = project.bladeWidth;

  const panels = cutlistItems.flatMap(item =>
    Array(item.quantity).fill({
      width: item.width,
      height: item.length
    })
  );

  let packer = await findOptimalPacking(panels, SHEET_WIDTH, SHEET_HEIGHT, BLADE_WIDTH);
  const boards = packer?.map((board: any) => {
    let usedRects = board.map((rect: any) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    }));

    let freeRects = calculateFreeSpaces(board, SHEET_WIDTH, SHEET_HEIGHT, BLADE_WIDTH); // Pass blade width

    return {
      width: board.width,
      height: board.height,
      usedRects,
      freeRects,
    };
  });

  if (boards.length > 0) {
    // update the project with the new needed and cost
    await updateProject(params.id, {
      boardsNeeded: boards.length,
      total: boards.length * project.boardPrice
    });
  }


  const boardCount = packer?.length ?? 0;
  const totalCost = boardCount * project.boardPrice;


  // boards?


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
        {boards ? (
          <BoardRenderer boards={boards} boardWidth={project.boardWidth} boardHeight={project.boardLength} />
        ) : (
          <p>Loading cutting layout...</p> // Placeholder while waiting for data
        )}

      </div>
    </Layout>
  );
}
