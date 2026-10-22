# 拾光小屋（ShiGuang Studio）

个人数字档案系统：记录学习、开发、创作、生活与成长。公开与私密并存。

## 技术栈
- 前端：Next.js 15（App Router）+ TypeScript + Tailwind CSS
- 后端 / 数据库 / 存储：Supabase（PostgreSQL + Storage + Auth）
- 部署：Vercel（默认 `*.vercel.app` 域名，后续可绑自定义域名）

## 设计基调（见《实施方案》10.1）
浅色森系（yayoi 配色）：暖米白底 `#F8F7F2` + 深林绿文字 `#334139/#394B3C`
+ 花粉黄绿主点缀 `#C9E97F` + 薰衣草紫次点缀 `#C7CDE0`；衬线标题 + 浅色磨砂玻璃。

## 快速开始
```bash
npm install
cp .env.example .env.local   # 填入你的 Supabase 三件套
npm run dev                  # 本地开发，默认 http://localhost:3000
```
> 构建验证：`npm run build`（沙箱内需先 `export NEXT_PRIVATE_SKIP_TRACE=1` 规避 .next/trace 写入限制）。

## 连接 Supabase（Phase 1 前必做）
1. 打开 https://supabase.com 注册并新建一个项目（区域选离你近的，如 Singapore）。
2. 项目后台 → Settings → API，复制三项：
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key（仅服务端用，切勿暴露到前端）→ `SUPABASE_SERVICE_ROLE_KEY`
3. 填入 `shiguang/.env.local`：
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
4. 之后由 Phase 1 生成建表 SQL + RLS 策略 + 7 个存储桶配置。


## 目录架构
```
app/        页面路由（10 个）
components/ 组件（layout + ui）
lib/        服务层（supabase 客户端）
hooks/      数据/状态 hooks
types/      类型定义
utils/      工具函数
public/     静态资源
```

## 后台管理（登录 + 录入）

站点已内置后台，路径 `/dashboard`，由 Supabase Auth 保护：

1. **首次创建站长账号**：打开 `/dashboard/login`，切换到「创建站长账号」注册；
   若注册后提示验证邮件，可在 Supabase 后台 `Authentication → Providers`
   关闭 Email 确认，注册后直接登录（本项目为单用户模型，注册的第一个账号即站长）。
   也可在 Supabase 后台 `Authentication → Users → Add user` 直接建账号。
2. **登录**：`/dashboard/login` 输入邮箱 + 密码。
3. **录入**：登录后进入总览，按模块「新建」即可录入内容。
   八个模块（学习档案 / 资料库 / 创作工坊 / 生活相册 / 相册照片 / 瞬间记录 /
   成长时间轴 / 文章）共用一套配置驱动表单，支持文本、Markdown、日期、
   可见性、分类、相册、封面图与图片上传。
   - 封面图、瞬间图片上传到对应**公开桶**（artworks / gallery / articles / moments），
     直接返回公开 URL。
   - **相册照片**的原图进入 `private` 私有桶（永不对外暴露），前端自动生成
     缩略图存入 `gallery` 公开桶。
   - 列表页支持编辑 / 删除；删除不可撤销，请谨慎。
4. **退出**：后台左下角「退出登录」。

> 鉴权由 `middleware.ts` 保护 `/dashboard/*`：未登录自动跳登录页，
> 已登录访问登录页自动跳后台。

## 目录架构
```
app/
  (site)/        公开站点（首页 + 8 模块 + 关于 + 入站遮罩/导航/页脚）
  dashboard/
    login/       登录 + 注册页（无需鉴权）
    (app)/       受保护后台：总览 / [module] 列表 / new 新建 / [id] 编辑
  globals.css
middleware.ts    后台鉴权中间件
lib/
  supabase/      Supabase 客户端（server / client）
  services/      服务端数据访问（site.ts：站点元信息、公开/后台计数）
  content-config.ts  后台录入的模块 / 字段 / 列表列配置（配置驱动）
components/
  dashboard/     后台：侧边栏、列表、表单、图片/照片上传
  layout/        公开站导航与页脚
  ui/            玻璃卡片、占位、搜索等
hooks/  types/  utils/
supabase/migrations/  0001 建表 + RLS、0002 存储桶
```

## 开发阶段
- Phase 0：脚手架 — 工程配置、目录、核心组件、Supabase 客户端结构
- Phase 1：数据库建表 SQL + RLS 策略 + 存储桶
- Phase 2：首页接入真实数据（服务端组件 + Supabase 读取，空库兜底）
- **Phase 3：后台登录（Supabase Auth）+ 八大模块录入（配置驱动 CRUD + 上传）✅ 已完成**
- 后续：首页/模块列表详情页、PostgreSQL 全文搜索、自定义域名部署
```
