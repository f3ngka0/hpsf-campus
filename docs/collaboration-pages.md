# 协作场景的 GitHub Pages 部署

正式网站仍由 GitHub Pages 仓库的 `main` 提供。该仓库只有静态网站文件；Supabase 服务端代码留在源工程的 `supabase/` 下，不会复制到网站 artifact。

Pages workflow 随 `.deploy/` 文件进入独立的静态网站仓库。它只部署仓库里已经提交的静态产物，不运行 `npm install` 或 `npm run build`；源工程仍需先本地完成构建、根目录镜像和 staging，再把 `.deploy/` 内容更新到静态仓库 `main`。

## 从源工程更新静态仓库

源工程的发布顺序是：

1. 配置构建时公开使用的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`。不要把 `service_role` 或部署密钥放进 `.env`、前端变量或构建产物。
2. 执行项目现有的 `npm run build`。构建应生成 `scene-manifest.json`、`data/scene-index.json`、`data/planting-edits.json` 和 `assets/editor-collaboration.js`，然后通过 `scripts/sync-static.mjs` 镜像到项目根目录。
3. 执行 `node scripts/stage-deploy.mjs`。`.deploy/` 包含静态文件以及 Pages workflow、部署同步客户端和本说明。将 `.deploy/` 的内容提交到独立的 `f3ngka0/hpsf-campus` 静态仓库 `main`。
4. 不要把整个源工程推入静态仓库。它不需要 `src/`、`public/`、`node_modules/`、Blender 文件或 Supabase 后端代码。

构建使用相对资源路径；Pages 网站地址为 `https://f3ngka0.github.io/hpsf-campus/`。`data/scene-index.json` 由 canonical scene build 生成。`scene-manifest.json` 的 `layoutHash` 必须与该 index 的实体布局匹配，`publishedRevision` 必须等于 `data/planting-edits.json` 中的 `meta.publishedRevision`；缺少 `meta` 的旧格式按首次发布 revision `0` 处理。编辑 JSON 可以向后兼容地增加顶层 `meta`，游戏读取仍只使用 `items` 和 `roads`。

当前 Supabase 项目的 ref 为 `wyljzauborelruwpoqye`，公开 URL 为 `https://wyljzauborelruwpoqye.supabase.co`。公开 URL 和 publishable key 已作为本地构建配置编译进 `assets/editor-collaboration.js`；文档不保存 key。该配置已构建并同步到本地静态产物，尚未推送或部署到 GitHub Pages。

普通 `npm run build` 和 `npm run sync` 不会读取或叠加 `dist-edit/`。旧单人编辑器仅可通过 `npm run build:edit` 的显式 `--include-local-editor` 选项覆盖到本地根目录用于维护；Pages staging 与 workflow artifact 会排除 `index.edit.html`、`index_edit.html` 和 `assets/edit-*`，保留 `assets/editor-collaboration.js`。

## 静态仓库中的 Pages workflow

将 `.deploy/.github/workflows/pages.yml` 一并提交到静态仓库。到仓库 Settings → Pages 将发布来源设为 GitHub Actions。每次向 `main` 推送或手动运行 workflow 时，它会：

1. 用静态仓库本次实际 `GITHUB_SHA` 更新 manifest 的 `gitCommit`，并从已提交的 planting edits 取得发布 revision；
2. 校验 scene index 的确定性 SHA-256 `layoutHash`，只组装网站白名单文件为 Pages artifact；
3. 等待 GitHub Pages 部署动作成功；
4. 若两个同步 secrets 均已配置，则通过 no-store 请求检查公开网站的 manifest 与本次 commit、layout hash、revision 一致，再调用 Supabase Edge Function。函数端仍会从固定的 Pages URL 重新验证 scene manifest、scene index 和 planting edits。

Pages artifact 只包含 `index.html`、公开资源目录、scene manifest、必要的公开 JSON、favicon 和 `.nojekyll`。workflow、源代码、Supabase migrations/functions 和环境文件不会上传到网站 artifact。

首次未接入 Supabase 时，保持两个 secret 都未设置，Pages 发布会照常完成并跳过同步。开始同步时，在静态仓库的 GitHub Actions secrets 中设置：

- `SUPABASE_DEPLOYMENT_SYNC_URL`：Edge Function URL，例如 `https://<project-ref>.supabase.co/functions/v1/deployment-sync`。
- `DEPLOYMENT_SECRET`：与 Supabase Edge Function 的部署专用 secret 完全相同的随机值。

只设置其中一个会让部署后的同步步骤失败，避免静默漏同步。部署密钥只作为 workflow 进程环境变量传递，并通过 `x-deployment-secret` 请求头发送；它不会进入页面、artifact、manifest、请求 URL 或脚本日志。Edge Function 的 `PUBLISHED_SITE_URL` 固定配置为 `https://f3ngka0.github.io/hpsf-campus/`，客户端请求不提供可替换 URL。

workflow 不会因为 `git push` 就提前标记 Published。Supabase 同步发生在 `deploy-pages` 成功之后，并且只有公开 CDN 已返回匹配本次发布的 manifest 时才发请求。revision `R` 的 Published Edits 必须与 scene manifest 一起进入静态仓库 `main`；创建 Release Candidate 本身不会改变 Published 状态。
