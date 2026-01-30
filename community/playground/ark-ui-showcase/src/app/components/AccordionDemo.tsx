import { Accordion } from '@ark-ui/react/accordion';
import { ChevronDown } from 'lucide-react';
import { DemoList } from './Layout';

export const AccordionDemo = () => (
  <DemoList
    items={[
      {
        label: "Basic Accordion",
        component: (
          <Accordion.Root defaultValue={['react']}>
            {['react', 'solid', 'vue', 'svelte'].map((item) => (
              <Accordion.Item key={item} value={item}>
                <Accordion.ItemTrigger>
                  What is {item.charAt(0).toUpperCase() + item.slice(1)}?
                  <Accordion.ItemIndicator>
                    <ChevronDown size={16} />
                  </Accordion.ItemIndicator>
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                  {item.charAt(0).toUpperCase() + item.slice(1)} is a powerful JavaScript library/framework for building modern user interfaces with component-based architecture.
                </Accordion.ItemContent>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        ),
      },
      {
        label: "Multiple Open Items",
        component: (
          <Accordion.Root multiple defaultValue={['item1', 'item2']}>
            <Accordion.Item value="item1">
              <Accordion.ItemTrigger>
                Features
                <Accordion.ItemIndicator>
                  <ChevronDown size={16} />
                </Accordion.ItemIndicator>
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                Ark UI provides unstyled, accessible components that work with any styling solution.
              </Accordion.ItemContent>
            </Accordion.Item>
            <Accordion.Item value="item2">
              <Accordion.ItemTrigger>
                Styling
                <Accordion.ItemIndicator>
                  <ChevronDown size={16} />
                </Accordion.ItemIndicator>
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                Use data attributes to target and style components with CSS, CSS-in-JS, or any styling approach.
              </Accordion.ItemContent>
            </Accordion.Item>
            <Accordion.Item value="item3">
              <Accordion.ItemTrigger>
                Accessibility
                <Accordion.ItemIndicator>
                  <ChevronDown size={16} />
                </Accordion.ItemIndicator>
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                Built with accessibility in mind, following WAI-ARIA best practices out of the box.
              </Accordion.ItemContent>
            </Accordion.Item>
          </Accordion.Root>
        ),
      },
    ]}
  />
);
