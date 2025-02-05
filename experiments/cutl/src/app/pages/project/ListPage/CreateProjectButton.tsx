"use client";

import { useTransition } from "react";
import { createProject } from "./functions";
import { Button } from "src/components/ui/button";

export function CreateProjectButton() {
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const newProject = await createProject();
      window.location.href = `/project/${newProject.id}`;
    });
  };

  return (

      <Button
        onClick={onClick}
        disabled={isPending}
      >
        New Project
      </Button>

  );
}
