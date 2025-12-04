import { RequestInfo } from 'rwsdk/worker';
import { YogaLoader } from '../components/YogaLoader.js';

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      <h1>Hello World</h1>
      <YogaLoader />
    </div>
  );
}
