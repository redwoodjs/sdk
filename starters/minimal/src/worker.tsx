import { defineApp } from '@redwoodjs/reloaded/worker';
import { index, layout } from '@redwoodjs/reloaded/router';
import { Document } from 'src/Document';
import { Home } from 'src/pages/Home';

type Context = {
}

export default defineApp<Context>([
  ({ ctx }) => {
    ctx;
    // setup ctx here
  },
  layout(Document, [
    index([
      Home,
    ]),
  ]),
])