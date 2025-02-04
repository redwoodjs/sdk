"use client";

import { useState, useRef } from "react";
import { RouteContext } from "../../../../lib/router";
import { type getSensor } from "./SensorDetailPage";


export function SensorForm(props: {
  sensor: Awaited<ReturnType<typeof getSensor>>;
  ctx: RouteContext;
}) {
  const [sensor, setSensor] = useState(props.sensor);

  return (
    <div>
      <h1>Sensor: {sensor.name}</h1>
    </div>
  );
}
