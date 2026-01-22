import { RequestInfo } from "rwsdk/worker";
import { Section, SectionTitle, SectionContent } from '../components/Layout';
import { AccordionDemo } from '../components/AccordionDemo';
import { CheckboxDemo } from '../components/CheckboxDemo';
import { SwitchDemo } from '../components/SwitchDemo';
import { SliderDemo } from '../components/SliderDemo';
import { RadioGroupDemo } from '../components/RadioGroupDemo';

export function Home({ ctx }: RequestInfo) {
  return (
    <div className="playground-container">
      <div className="playground-header">
        <h1>Ark UI Playground</h1>
        <p>Component showcase for RedwoodSDK with Ark UI</p>
      </div>

      <Section>
        <SectionTitle id="accordion">Accordion</SectionTitle>
        <SectionContent>
          <AccordionDemo />
        </SectionContent>
      </Section>

      <Section>
        <SectionTitle id="checkbox">Checkbox</SectionTitle>
        <SectionContent>
          <CheckboxDemo />
        </SectionContent>
      </Section>

      <Section>
        <SectionTitle id="switch">Switch</SectionTitle>
        <SectionContent>
          <SwitchDemo />
        </SectionContent>
      </Section>

      <Section>
        <SectionTitle id="slider">Slider</SectionTitle>
        <SectionContent>
          <SliderDemo />
        </SectionContent>
      </Section>

      <Section>
        <SectionTitle id="radio">Radio Group</SectionTitle>
        <SectionContent>
          <RadioGroupDemo />
        </SectionContent>
      </Section>
    </div>
  );
}
