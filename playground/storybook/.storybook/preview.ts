import "../src/app/styles.css";
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'error',
      context: {
        include: ['body'],
        exclude: ['[data-no-a11y-check]'],
      },
    },
  },
};

export default preview;
