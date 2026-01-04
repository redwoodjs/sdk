import { Checkbox } from '@ark-ui/react/checkbox';
import { Check } from 'lucide-react';
import { DemoList } from './Layout';

export const CheckboxDemo = () => (
  <DemoList
    items={[
      {
        label: "Basic Checkboxes",
        component: (
          <div className="component-grid">
            <Checkbox.Root>
              <Checkbox.Control>
                <Checkbox.Indicator>
                  <Check size={14} />
                </Checkbox.Indicator>
              </Checkbox.Control>
              <Checkbox.Label>Accept terms</Checkbox.Label>
            </Checkbox.Root>
            <Checkbox.Root defaultChecked>
              <Checkbox.Control>
                <Checkbox.Indicator>
                  <Check size={14} />
                </Checkbox.Indicator>
              </Checkbox.Control>
              <Checkbox.Label>Subscribe to newsletter</Checkbox.Label>
            </Checkbox.Root>
            <Checkbox.Root>
              <Checkbox.Control>
                <Checkbox.Indicator>
                  <Check size={14} />
                </Checkbox.Indicator>
              </Checkbox.Control>
              <Checkbox.Label>Enable notifications</Checkbox.Label>
            </Checkbox.Root>
          </div>
        ),
      },
    ]}
  />
);
