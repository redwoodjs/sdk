import { RadioGroup } from '@ark-ui/react/radio-group';
import { DemoList } from './Layout';

export const RadioGroupDemo = () => (
  <DemoList
    items={[
      {
        label: "Basic Radio Group",
        component: (
          <RadioGroup.Root defaultValue="react">
            <RadioGroup.Item value="react">
              <RadioGroup.ItemHiddenInput />
              <RadioGroup.ItemControl>
                <span />
              </RadioGroup.ItemControl>
              <RadioGroup.ItemText>React</RadioGroup.ItemText>
            </RadioGroup.Item>
            <RadioGroup.Item value="vue">
              <RadioGroup.ItemHiddenInput />
              <RadioGroup.ItemControl>
                <span />
              </RadioGroup.ItemControl>
              <RadioGroup.ItemText>Vue</RadioGroup.ItemText>
            </RadioGroup.Item>
            <RadioGroup.Item value="svelte">
              <RadioGroup.ItemHiddenInput />
              <RadioGroup.ItemControl>
                <span />
              </RadioGroup.ItemControl>
              <RadioGroup.ItemText>Svelte</RadioGroup.ItemText>
            </RadioGroup.Item>
          </RadioGroup.Root>
        ),
      },
    ]}
  />
);
