import { Button } from "src/components/ui/button";
import { deleteProject } from "../ListPage/functions";
import { useTransition } from "react";

export function DeleteProjectButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      await deleteProject(id);
    });
    // TODO: project list should update without a page reload
    window.location.href = "/project/list";
  };

  return (
    <Button
      className="bg-red-500 hover:bg-red-600"
      onClick={onClick}
      disabled={isPending}
    >
      Delete Project
    </Button>
  );
}
