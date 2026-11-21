/**
 * 迁移执行器（本地手动跑，不进构建）
 *
 * 用法：
 *   PGPASSWORD='数据库密码' node scripts/migrate.mjs supabase/migrations/0004_library.sql
 *   PGPASSWORD='数据库密码' node scripts/migrate.mjs            # 跑 migrations 目录下所有未执行的
 *
 * 连接串优先级：
 *   SUPABASE_DB_URL（完整 postgresql://...）
 *   -> 首尔连接池 + PGPASSWORD（本项目实测唯一可达路径，直连 db.<ref> 的域名不存在）
 *
 * 密码只从环境变量读，不落盘、不打印。
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const REF = "vezqerhcachvxtkiyxnz";

function buildConfig() {
  if (process.env.SUPABASE_DB_URL) {
    return { connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } };
  }
  const password = process.env.PGPASSWORD;
  if (!password) {
    console.error("缺少 PGPASSWORD 或 SUPABASE_DB_URL");
    process.exit(1);
  }
  return {
    host: "aws-0-ap-northeast-2.pooler.supabase.com",
    port: 6543,
    user: `postgres.${REF}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  };
}

const explicit = process.argv[2];
const dir = path.resolve("supabase/migrations");
const files = explicit
  ? [path.resolve(explicit)]
  : fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => path.join(dir, f));

const client = new pg.Client(buildConfig());
await client.connect();

await client.query(`
  create table if not exists public._migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`);

// 首次建立追踪表时，把"已经手工执行过"的迁移登记为已应用（避免重复跑旧迁移）
const tracked = await client.query("select count(*)::int as n from public._migrations");
if (tracked.rows[0].n === 0) {
  const bookExists = await client.query("select to_regclass('public.book') is not null as ok");
  const seeds = [];
  if (bookExists.rows[0].ok) seeds.push("0003_curriculum.sql");
  if (seeds.length) {
    for (const s of seeds) {
      await client.query("insert into public._migrations(name) values ($1) on conflict do nothing", [s]);
    }
    console.log(`登记已存在的迁移：${seeds.join(", ")}`);
  }
}

const done = new Set(
  (await client.query("select name from public._migrations")).rows.map((r) => r.name)
);

let applied = 0;
for (const file of files) {
  const name = path.basename(file);
  if (done.has(name)) {
    console.log(`跳过（已执行） ${name}`);
    continue;
  }
  const sql = fs.readFileSync(file, "utf8");
  process.stdout.write(`执行 ${name} ... `);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into public._migrations(name) values ($1)", [name]);
    await client.query("commit");
    applied += 1;
    console.log("OK");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    console.log("失败");
    console.error(err.message);
    process.exitCode = 1;
    break;
  }
}

if (applied > 0) console.log(`\n完成，共执行 ${applied} 个迁移。`);
await client.end();
