import { Slider } from '@ark-ui/react/slider';
import { DemoList } from './Layout';

export const SliderDemo = () => (
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
);
