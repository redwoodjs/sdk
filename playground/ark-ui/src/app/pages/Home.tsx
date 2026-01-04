import React from 'react';
import { Accordion } from '@ark-ui/react/accordion';
import { Checkbox } from '@ark-ui/react/checkbox';
import { Switch } from '@ark-ui/react/switch';
import { Slider } from '@ark-ui/react/slider';
import { RadioGroup } from '@ark-ui/react/radio-group';

interface SectionProps {
  children: React.ReactNode;
}

const Section = ({ children }: SectionProps) => (
  <div className="playground-section">{children}</div>
);

interface SectionTitleProps {
  children: React.ReactNode;
  id: string;
}

const SectionTitle = ({ children, id }: SectionTitleProps) => (
  <div className="section-title" id={id}>
    <h3>{children}</h3>
  </div>
);

interface SectionContentProps {
  children: React.ReactNode;
}

const SectionContent = ({ children }: SectionContentProps) => (
  <div className="section-content">{children}</div>
);

interface DemoItem {
  label: string;
  component: JSX.Element;
}

interface DemoListProps {
  items: DemoItem[];
}

const DemoList = ({ items }: DemoListProps) => (
  <>
    {items.map(({ label, component }) => (
      <div key={label} className="demo-item">
        <div className="demo-label">{label}</div>
        {component}
      </div>
    ))}
  </>
);

export function Home({ ctx }: RequestInfo) {
  return (
    <div className="playground-container">
      <div className="playground-header">
        <h1>Ark UI Playground</h1>
        <p>Headless components styled with pure CSS</p>
      </div>

      <Section>
        <SectionTitle id="accordion">Accordion</SectionTitle>
        <SectionContent>
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
                          <Accordion.ItemIndicator>▼</Accordion.ItemIndicator>
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
                        <Accordion.ItemIndicator>▼</Accordion.ItemIndicator>
                      </Accordion.ItemTrigger>
                      <Accordion.ItemContent>
                        Ark UI provides unstyled, accessible components that work with any styling solution.
                      </Accordion.ItemContent>
                    </Accordion.Item>
                    <Accordion.Item value="item2">
                      <Accordion.ItemTrigger>
                        Styling
                        <Accordion.ItemIndicator>▼</Accordion.ItemIndicator>
                      </Accordion.ItemTrigger>
                      <Accordion.ItemContent>
                        Use data attributes to target and style components with CSS, CSS-in-JS, or any styling approach.
                      </Accordion.ItemContent>
                    </Accordion.Item>
                    <Accordion.Item value="item3">
                      <Accordion.ItemTrigger>
                        Accessibility
                        <Accordion.ItemIndicator>▼</Accordion.ItemIndicator>
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
        </SectionContent>
      </Section>

      <Section>
        <SectionTitle id="checkbox">Checkbox</SectionTitle>
        <SectionContent>
          <DemoList
            items={[
              {
                label: "Basic Checkboxes",
                component: (
                  <div className="component-grid">
                    <Checkbox.Root>
                      <Checkbox.Control>
                        <Checkbox.Indicator>✓</Checkbox.Indicator>
                      </Checkbox.Control>
                      <Checkbox.Label>Accept terms</Checkbox.Label>
                    </Checkbox.Root>
                    <Checkbox.Root defaultChecked>
                      <Checkbox.Control>
                        <Checkbox.Indicator>✓</Checkbox.Indicator>
                      </Checkbox.Control>
                      <Checkbox.Label>Subscribe to newsletter</Checkbox.Label>
                    </Checkbox.Root>
                    <Checkbox.Root>
                      <Checkbox.Control>
                        <Checkbox.Indicator>✓</Checkbox.Indicator>
                      </Checkbox.Control>
                      <Checkbox.Label>Enable notifications</Checkbox.Label>
                    </Checkbox.Root>
                  </div>
                ),
              },
            ]}
          />
        </SectionContent>
      </Section>

      <Section>
        <SectionTitle id="switch">Switch</SectionTitle>
        <SectionContent>
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
        </SectionContent>
      </Section>

      <Section>
        <SectionTitle id="slider">Slider</SectionTitle>
        <SectionContent>
          <DemoList
            items={[
              {
                label: "Range Slider",
                component: (
                  <Slider.Root min={0} max={100} defaultValue={[50]}>
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Range />
                      </Slider.Track>
                      <Slider.Thumb index={0} />
                    </Slider.Control>
                  </Slider.Root>
                ),
              },
              {
                label: "Multiple Thumbs",
                component: (
                  <Slider.Root min={0} max={100} defaultValue={[25, 75]}>
                    <Slider.Control>
                      <Slider.Track>
                        <Slider.Range />
                      </Slider.Track>
                      <Slider.Thumb index={0} />
                      <Slider.Thumb index={1} />
                    </Slider.Control>
                  </Slider.Root>
                ),
              },
            ]}
          />
        </SectionContent>
      </Section>

      <Section>
        <SectionTitle id="radio">Radio Group</SectionTitle>
        <SectionContent>
          <DemoList
            items={[
              {
                label: "Basic Radio Group",
                component: (
                  <RadioGroup.Root defaultValue="react">
                    <RadioGroup.Item value="react">
                      <RadioGroup.ItemControl>
                        <span />
                      </RadioGroup.ItemControl>
                      <RadioGroup.ItemText>React</RadioGroup.ItemText>
                    </RadioGroup.Item>
                    <RadioGroup.Item value="vue">
                      <RadioGroup.ItemControl>
                        <span />
                      </RadioGroup.ItemControl>
                      <RadioGroup.ItemText>Vue</RadioGroup.ItemText>
                    </RadioGroup.Item>
                    <RadioGroup.Item value="svelte">
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
        </SectionContent>
      </Section>
    </div>
  );
}