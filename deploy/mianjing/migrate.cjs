'use strict';
// Run only after the deployer has backed up the shared database.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = '/www/wwwroot/mianjing-api';
const allowed = '20261102000000_add_mianjing';
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at',
    );
    if (rows.some((row) => !row.finished_at && !row.rolled_back_at))
      throw new Error('Unresolved production migration');
    const applied = rows.filter((row) => row.finished_at && !row.rolled_back_at);
    const names = new Set(applied.map((row) => row.migration_name));
    const migrationRoot = path.resolve('prisma/migrations');
    for (const name of fs.readdirSync(migrationRoot)) {
      if (
        fs.statSync(path.join(migrationRoot, name)).isDirectory() &&
        !names.has(name) &&
        name !== allowed
      )
        throw new Error('Unapproved pending migration: ' + name);
    }
    for (const row of applied) {
      if (!/^[a-zA-Z0-9_]+$/.test(row.migration_name))
        throw new Error('Invalid migration identifier');
      const target = path.join(migrationRoot, row.migration_name, 'migration.sql');
      const candidates = [
        target,
        path.join(root, 'shared/migration-history', row.migration_name, 'migration.sql'),
        path.join('/www/wwwroot/xuxiao-api/prisma/migrations', row.migration_name, 'migration.sql'),
      ];
      const source = candidates.find((file) => fs.existsSync(file));
      if (!source || digest(source) !== row.checksum)
        throw new Error('Applied migration checksum mismatch: ' + row.migration_name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (source !== target) fs.copyFileSync(source, target);
      const archive = path.join(
        root,
        'shared/migration-history',
        row.migration_name,
        'migration.sql',
      );
      fs.mkdirSync(path.dirname(archive), { recursive: true });
      if (fs.existsSync(archive) && digest(archive) !== row.checksum)
        throw new Error('Archived migration differs');
      if (!fs.existsSync(archive)) fs.copyFileSync(target, archive);
    }
    const before = applied.map((row) => row.migration_name).sort();
    const admin = await client.query('SELECT id FROM "User" WHERE id=2 AND email=$1', [
      '542761360@qq.com',
    ]);
    if (admin.rowCount !== 1) throw new Error('Configured administrator not found');
    const dir = process.env.MIANJING_BACKUP_DIR;
    if (!dir || !dir.startsWith('/www/backup/mianjing-deploy/'))
      throw new Error('Missing private backup directory');
    fs.writeFileSync(path.join(dir, 'migrations-before.json'), JSON.stringify(applied, null, 2), {
      mode: 0o600,
    });
    if (!names.has(allowed)) {
      const url = new URL(process.env.DATABASE_URL);
      const env = {
        ...process.env,
        PGHOST: url.hostname,
        PGPORT: url.port || '5432',
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      };
      if (url.searchParams.get('sslmode')) env.PGSSLMODE = url.searchParams.get('sslmode');
      const result = spawnSync(
        '/www/server/pgsql/bin/pg_dump',
        [
          '--format=custom',
          '--no-owner',
          '--lock-wait-timeout=10s',
          '--file=' + path.join(dir, 'database.dump'),
        ],
        { env, encoding: 'utf8' },
      );
      if (result.status !== 0) throw new Error('Database backup failed; migration not started');
      const check = spawnSync(
        '/www/server/pgsql/bin/pg_restore',
        ['--list', path.join(dir, 'database.dump')],
        { encoding: 'utf8' },
      );
      if (check.status !== 0) throw new Error('Database backup verification failed');
    }
    const result = spawnSync('./node_modules/.bin/prisma', ['migrate', 'deploy'], {
      env: process.env,
      encoding: 'utf8',
    });
    fs.writeFileSync(
      path.join(dir, 'migration-command.log'),
      (result.stdout || '') + (result.stderr || ''),
      { mode: 0o600 },
    );
    if (result.status !== 0)
      throw new Error('Migration failed; details saved in private backup directory');
    const after = await client.query(
      'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
    );
    const expected = [...new Set([...before, allowed])].sort();
    if (JSON.stringify(after.rows.map((row) => row.migration_name)) !== JSON.stringify(expected))
      throw new Error('Unexpected migration set after deployment');
    console.log('Migration history verified; only mianjing migration permitted');
  } finally {
    await client.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
