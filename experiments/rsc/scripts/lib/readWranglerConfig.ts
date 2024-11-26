import { resolve } from 'node:path';
import { readFile } from 'fs/promises'
import { ROOT_DIR } from '../configs.mjs';
import { parse as parseToml } from 'toml'

export const readWranglerConfig = async () => {
  return parseToml(await readFile(resolve(ROOT_DIR, 'wrangler.toml'), 'utf8'))
}