"use server";

import { Layout } from "../../Layout";

import { CreateProjectButton } from "./CreateProjectButton";
import { db } from "../../../../db";
import { RouteOptions } from "../../../../lib/router";
import { link } from "src/shared/links";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "src/components/ui/table";

export type CutlistItem = {
  width: number;
  length: number;
  quantity: number;
};

export type Project = {
  id: string;
  createdAt: Date;
  title: string;
  total: number;
  boardsNeeded: number;
};

async function getProjectListSummary(userId: string) {
  const projects =
    (await db.project.findMany({
      select: {
        id: true,
        title: true,
        createdAt: true,
        total: true,
        boardsNeeded: true,
      },
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    })) ?? [];

  return projects.map((project: Project) => {
    const { id, createdAt, title, total, boardsNeeded } = project;
    return {
      id,
      createdAt,
      title,
      total,
      boardsNeeded,
    };
  });
}

export default async function ProjectListPage({ ctx }: RouteOptions) {
  const projects = await getProjectListSummary(ctx.user.id);
  return (
    <Layout ctx={ctx}>
      <div className="space-y-2 py-4 text-right">
        <CreateProjectButton />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Boards Needed</TableHead>
            <TableHead>Total</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((i: Project) => (
            <ProjectListItem {...i} key={"project-" + i.id} />
          ))}
        </TableBody>
      </Table>
    </Layout>
  );
}

function ProjectListItem(
  props: Awaited<ReturnType<typeof getProjectListSummary>>[number],
) {
  return (
    <TableRow>
      <TableCell>
        <a href={link("/project/:id", { id: props.id })}>{props.title}</a>
      </TableCell>
      <TableCell>
        {props.createdAt.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </TableCell>
      <TableCell>{props.boardsNeeded}</TableCell>
      <TableCell>{props.total}</TableCell>
      <TableCell className="text-right">
        <a href={link("/project/:id", { id: props.id })}>Edit</a>
      </TableCell>
    </TableRow>
  );
}
