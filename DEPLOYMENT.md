# 拾光事务所 · 部署与上线指南

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
