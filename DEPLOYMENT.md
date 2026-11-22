# 拾光小屋 · 部署与上线指南

本项目是 **Next.js 15（App Router）+ Supabase** 的个人数字档案站点。
数据库、登录鉴权、文件存储都用你自己的 Supabase 项目（已在本地跑通）。

上线有两条路线：
- **A. WorkBuddy 托管（即时上线，分钟级拿到分享链接）** —— 已在本次帮你发布，详见下方「重新发布」。
- **B. Vercel + 自定义域名（你之前定的正式方案）** —— 需要你自己的 Vercel 账号，见下文步骤。

---

## 一、上线前必做：Supabase 生产环境配置（两条路线都要）

无论用哪条路线，公开站点 / 后台登录都依赖 Supabase。上线后**必须把生产域名加进 Supabase 的允许列表**，否则线上登录会失败。

1. 打开你的 Supabase 后台 → `Authentication` → `URL Configuration`
2. **Site URL** 填你的上线地址，例如：`https://你的域名` 或 WorkBuddy 给的分享链接
3. **Redirect URLs** 增加一行：同上地址（含 `https://`）
4. 如果使用邮箱密码登录且之前关掉了 `Confirm email`，保持关闭即可；否则新用户需验证邮箱。

> Supabase 的 `anon` 公钥可以公开，但 **`service_role` 密钥是最高权限密钥**，只在服务端使用、绝不要写进前端代码或暴露给浏览器。本项目已正确区分（`NEXT_PUBLIC_` 前缀的才是浏览器可见的）。

---

## 二、路线 A：WorkBuddy 托管（已发布，如何更新）

- 分享链接在发布成功后由系统给出。
- 之后每次改了代码想同步到线上：直接告诉我「**更新线上** / **重新发布**」即可，我会把当前目录重新打包上线（链接不变）。
- 想下线：告诉我「**下线 / 取消发布**」。

> 注意：WorkBuddy 托管使用的是 `.env.production`（生产环境变量）。它和本地 `.env.local` 值一致，本地 `npm run dev` 不会读取它，可放心保留。

---

## 三、路线 B：Vercel + 自定义域名（正式方案，分步）

### 第 1 步：把代码推到 GitHub
1. 在 GitHub 新建一个仓库（例如 `shiguang`）。
2. 在本机项目目录打开终端：
   ```bash
   git init
   git add .
   git commit -m "init shiguang"
   git branch -M main
   git remote add origin https://github.com/你的用户名/你的仓库.git
   git push -u origin main
   ```
   > `.gitignore` 已忽略 `.env*` 和 `node_modules`，密钥不会被提交。

### 第 2 步：Vercel 导入项目
1. 打开 https://vercel.com ，用 GitHub 登录。
2. `Add New` → `Project` → 选刚才的仓库 → `Import`。
3. Framework 会自动识别为 **Next.js**，不用改构建命令。

### 第 3 步：配置环境变量（关键）
在 Vercel 项目 → `Settings` → `Environment Variables` 添加这 **3 个**（值来自你本地 `.env.local`）：

| 变量名 | 说明 | 获取位置 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 | Supabase 后台 `Project Settings` → `API` → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公开密钥（浏览器用） | Supabase 后台 `API` → `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端密钥（仅服务端） | Supabase 后台 `API` → `service_role` key |

> 三个都要加，且对 `Production` / `Preview` / `Development` 全选生效。

**P2 资料库与问答再加 4 个**（不加会导致问答返回 503、线上推送资料 401）：

| 变量名 | 说明 |
|---|---|
| `DEEPSEEK_API_KEY` | 云端模型通道。**线上唯一可用的模型通道**（Vercel 摸不到你本机的归一桥） |
| `UNYRA_INGEST_SECRET` | 与本地 `.env.local` 同一个值，脚本推资料时的 HMAC 密钥 |
| `UNYRA_OWNER_USER_ID` | 资料归属账号的 `auth.users.id` |
| `UNYRA_BRIDGE_URL` | 可不填，默认 `http://127.0.0.1:4399`（线上必然连不上，会自动回退 DeepSeek） |

- 改完环境变量**必须重新部署一次**（`Deployments` → `Redeploy`），否则运行中的实例读不到新值。
- 查环境变量是否生效：`curl -X POST https://你的域名/api/library/ask -H 'content-type: application/json' -d '{"question":"测试"}'`，返回 401（未登录）说明接口在；登录后返回 `NO_CHANNEL` 说明 key 没配上。


### 第 4 步：部署
回到 `Deployments` 点 `Redeploy`，或推送代码会自动部署。成功后 Vercel 给一个 `*.vercel.app` 临时域名。

### 第 5 步：绑定自定义域名
1. Vercel 项目 → `Settings` → `Domains` → 输入你的域名 → `Add`。
2. 按提示去你的域名服务商（阿里云 / 腾讯云 / Cloudflare 等）添加 **DNS 解析**：
   - 类型 `CNAME`，主机记录 `www` / `@`，指向 Vercel 给的目标地址；或
   - 按 Vercel 页面提示添加 `A` 记录（IPv4 指向 `76.76.21.21`）。
3. 等待 DNS 生效（几分钟到几小时），状态变 `Valid` 即绑定成功。
4. **回到第一节**，把你的自定义域名填进 Supabase 的 Site URL 和 Redirect URLs。

---

## 四、常见问题

- **线上登录失败 / 跳转不对**：99% 是 Supabase 的 Site URL / Redirect URLs 没加生产域名，见第一节。
- **页面白屏、数据为空**：检查 Vercel 环境变量是否三个都填对；确认 Supabase 里已录入且 `visibility=public`。
- **上传图片失败**：确认 Supabase 的 Storage 桶（artworks / gallery / articles / moments / private）已按 `supabase/migrations/0002_storage.sql` 建好。
- **本地能跑、线上报错**：本地 `.env.local` 与线上环境变量是否一致；线上构建日志在 Vercel `Deployments` → 对应部署 → `Build Logs`。

---

## 五、资料库（P2）日常操作

### 迁移数据库
```bash
PGPASSWORD='数据库密码' node scripts/migrate.mjs supabase/migrations/0004_library.sql
PGPASSWORD='数据库密码' node scripts/migrate.mjs      # 跑全部未执行的
```
已执行的迁移记在 `public._migrations`，重复跑会自动跳过。

### 把归一资料同步到线上
线上站点在 Vercel，访问不到你本机的归一桥（`127.0.0.1:4399`），所以要**本机主动推**：
```bash
node scripts/sync-unyra.mjs                          # 推到 NEXT_PUBLIC_SITE_URL
node scripts/sync-unyra.mjs --site https://www.xuexiaoge.cn
node scripts/sync-unyra.mjs --dry                    # 只看清单不推
```
内容没变会返回 `内容未变，跳过`（幂等，不会重建分块、不碰学习记录）。

### 本机开发时的「立即同步归一」按钮
`npm run dev` 时服务端能连到桥，这个按钮直接可用，并且会顺带用 bge-m3 补向量。
线上点它会明确报「连不上归一桥」——这是预期行为，用上面的脚本推。

### 检索为什么是「两条腿」
- 关键词腿：PGroonga 中文分词（本库已启用 3.2.5）
- 语义腿：pgvector + bge-m3（1024 维），需要问题向量；云端算不了，所以线上只有关键词腿
- 两条腿用 RRF 合并；召回覆盖度低于 0.34 直接拒答，不给猜测答案

### 密钥也可以不写在 Vercel 里
`app_config` 表（迁移 `0007`）是服务端私有配置，RLS 开启且无策略，anon / 登录用户都读不到（实测 anon 返回 403/401），只有 service role 能查。
读取顺序：**环境变量 → app_config**。所以模型 key、推送密钥既可以填 Vercel 环境变量，也可以直接写进这张表，后者不用重新部署：

```bash
# 用 service_role key 直接写（本地跑，不要放进前端）
curl -X POST "$SUPABASE_URL/rest/v1/app_config" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "content-type: application/json" -H "Prefer: resolution=merge-duplicates" \
  -d '[{"key":"deepseek_api_key","value":"sk-..."}]'
```

已用的键名：`deepseek_api_key`、`unyra_ingest_secret`、`unyra_owner_user_id`。

---

## 六、背诵板块（私人知识库 + FSRS 间隔复习）

### 一次性准备
```bash
PGPASSWORD='数据库密码' node scripts/migrate.mjs supabase/migrations/0008_recite.sql
```
`app_config` 里要有 `recite_owner_user_id`（只这个账号能进）。没配时任何人登录后都能进自己的空间；
配了之后其他账号访问 `/recite` 直接 404。

### 表与权限
- `knowledge_item` / `review_unit` / `review_state` / `review_log` / `attachment` / `recite_settings`
- 六表 RLS 一律 `owner_user_id = auth.uid()`；匿名角色已 revoke
- `review_log` 只给 select / insert：历史只能追加，不能改删
- 附件放 `private` 桶的 `recite/<uid>/` 下；下载走 `/api/recite/file/[id]`，
  先按会话验归属再签 10 分钟地址（未登录 401 / 他人 403 / 不存在 404）

### 复习规则
- 调度用 ts-fsrs 6.x（FSRS-6），四档评价后间隔全由算法给出，代码里没有写死天数
- 队列按**自然日**组织（时区取自 `recite_settings.timezone`，默认 Asia/Shanghai）：
  逾期 = due < 今天 00:00；今日到期 = due < 明天 00:00；新卡 = 从未复习过
- 新卡每日自动上限 10（可改、可关）；手动挑的不受此限
- 全部到期项都会列出，不做硬截断；中途退出只保留已提交的记录
- 关了「短期学习步骤」：否则新卡评分后 10 分钟又到期，一天内反复出现

### 编辑器
Markdown 是唯一真源，富文本只是视图，切换不另存 HTML。
公式在富文本里以 `$...$` 源码显示，阅读态才排版；含 `|` 的公式建议直接在 Markdown 模式写。
