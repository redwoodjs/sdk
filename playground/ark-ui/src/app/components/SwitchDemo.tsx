"use client";

import { Switch } from '@ark-ui/react/switch';
import { DemoList } from './Layout';

export const SwitchDemo = () => (
  <DemoList
    items={[
      {
        label: "Toggle Switches",
        component: (
          <div className="component-grid">
            <Switch.Root>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Label>Airplane mode</Switch.Label>
            </Switch.Root>
            <Switch.Root defaultChecked>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Label>Wi-Fi enabled</Switch.Label>
            </Switch.Root>
            <Switch.Root>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Label>Dark mode</Switch.Label>
            </Switch.Root>
          </div>
        ),
      },
    ]}
  />
);
