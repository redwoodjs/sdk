import { defineApp } from '@redwoodjs/sdk/worker';
import { index, layout } from '@redwoodjs/sdk/router';
import { Document } from 'src/Document';
import HomePage from 'src/pages/home/HomePage';

type Context = {
}

export default defineApp<Context>([
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  layout(Document, [
    index([
      HomePage,
    ]),
  ]),
])