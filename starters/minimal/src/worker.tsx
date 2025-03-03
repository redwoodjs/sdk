import { defineApp } from 'redwood-sdk/worker';
import { index, layout } from 'redwood-sdk/router';
import { Document } from 'src/Document';
import { Home } from 'src/pages/Home';

type Context = {
}

export default defineApp<Context>([
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  layout(Document, [
    index([
      Home,
    ]),
  ]),
])