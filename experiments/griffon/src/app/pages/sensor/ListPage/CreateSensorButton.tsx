"use client";

import { useTransition } from "react";
import { createSensor } from "./functions";
import { Button } from "src/components/ui/button";

export function CreateSensorButton() {
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const newSensor = await createSensor();
      window.location.href = `/sensor/${newSensor.id}`;
    });
  };

  return (

      <Button
        onClick={onClick} 
        disabled={isPending}
      >
        Add
      </Button>

  );
}
