import snakeCase from 'lodash/snakeCase';
import { $ } from './lib/$.mjs';
import { readdir } from 'fs/promises';
import { resolve } from 'path'
import { ROOT_DIR } from './lib/constants.mjs';

const getNextMigrationNumber = async (): Promise<string> => {
  const files = await readdir(resolve(ROOT_DIR, './migrations'));
  const numbers = files
    .map(file => parseInt(file.split('_')[0]))
    .filter(num => !isNaN(num));

  const lastNumber = Math.max(0, ...numbers);
  return String(lastNumber + 1).padStart(4, '0');
}

export const migrateNew = async (name: string) => {
  if (!name) {
    console.log('Usage: pnpm migrate:new <migration-name>');
    console.log('Example: pnpm migrate:new "Add user"');
    process.exit(1);
  }

  const nextNum = await getNextMigrationNumber();
  const filepath = `./migrations/${nextNum}_${snakeCase(name.toLowerCase())}.sql`;
  await $`pnpm prisma migrate diff --from-local-d1 --to-schema-datamodel ./prisma/schema.prisma --script --output ${filepath}`;

  console.log('Generated migration:', filepath);
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  migrateNew(process.argv[2]);
}
