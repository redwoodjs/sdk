"use client";

import { useState, useRef } from "react";
import { RouteContext } from "../../../../lib/router";
import { type getSensor } from "./SensorDetailPage";
import { saveSensor } from "./functions";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";

export function SensorForm(props: {
  sensor: Awaited<ReturnType<typeof getSensor>>;
  ctx: RouteContext;
}) {
  const [sensor, setSensor] = useState(props.sensor);
  

  return (
    <div>
      <div>
        <div>
          <Input type="text" id="name" value={sensor.name} onChange={(e) => setSensor({ ...sensor, name: e.target.value })} />
        </div>
        <div>
          <Input type="text" id="uniqueId" value={sensor.uniqueId} onChange={(e) => setSensor({ ...sensor, uniqueId: e.target.value })} />
        </div>
        <div>
          <Button onClick={async () => {
            await saveSensor(sensor.id, sensor, props.ctx.user.id);
            window.location.href = "/sensor/list";
          }}>Save</Button>
        </div>
      </div>
    </div>
  );
}
