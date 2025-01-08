import { resolve } from 'path'
import { ROOT_DIR } from './lib/constants.mjs';
import { runDevServer } from './runDevServer.mjs';

export const runWorkerScript = async (relativeScriptPath: string) => {
  if (!relativeScriptPath) {
    console.error('Error: Script path is required');
    console.log('\nUsage:');
    console.log('  pnpm worker:run <script-path>');
    console.log('\nExample:');
    console.log('  pnpm worker:run src/workers/myScript.ts\n');
    process.exit(1);
  }

  const scriptPath = resolve(ROOT_DIR, relativeScriptPath);
  const server = await runDevServer();
  const address = server.httpServer?.address();

  if (!address || typeof address === 'string') {
    throw new Error('Dev server address is invalid');
  }

  await fetch(`http://localhost:${address.port}/`, {
    headers: {
      'x-vite-fetch': JSON.stringify({
        entry: scriptPath,
      }),
    },
  })

  await server.close()
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  runWorkerScript(process.argv[2])
}
