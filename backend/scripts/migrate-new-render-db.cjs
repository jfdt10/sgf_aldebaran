const { spawnSync } = require('node:child_process');
const { dirname, join } = require('node:path');

if (
  process.env.RENDER !== 'true' ||
  process.env.RENDER_EXTERNAL_HOSTNAME !== 'aldebaran-backend-jusq.onrender.com' ||
  process.env.RENDER_GIT_BRANCH !== 'hmlg'
) {
  process.exit(0);
}

const database = new URL(process.env.DATABASE_URL);
if (
  database.hostname !== 'dpg-dc4a89e1egvs73fpv8b0-a' ||
  database.pathname !== '/aldebaran_db_bgx1'
) {
  throw new Error('O banco configurado no Render não corresponde ao novo aldebaran-db.');
}

const cli = join(dirname(require.resolve('prisma/package.json')), require('prisma/package.json').bin.prisma);
const { error, status } = spawnSync(
  process.execPath,
  [cli, 'migrate', 'deploy'],
  { stdio: 'inherit' },
);
if (error) throw error;
process.exitCode = status ?? 1;
