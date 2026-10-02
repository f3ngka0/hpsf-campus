# 合师漫游 · 云游合浦师范

基于 Three.js 的合浦师范学校三维校园浏览项目。校园建筑、道路、水体与景观由本地数据和 Blender 模型组成，浏览器提供鸟瞰导航、景点介绍、实景照片对照和导览功能；维护者可以使用独立的本地编辑页，或进入受邀用户使用的在线协作编辑模式。

Demo：https://f3ngka0.github.io/hpsf-campus/

## 当前功能

- **三维校园浏览**：展示教学楼、办公楼、图书馆、宿舍、食堂、体育馆、校门，以及东坡亭、东坡井等校园建筑与景观。
- **目的地导航**：从地点列表、导览图或建筑标签定位景点；跟随导览依次浏览各个地点。
- **照片对照**：查看景点照片，以及按建筑和区域分类的本地参考相册。
- **漫游工具**：日落光线、画面截图、全屏浏览、建筑名称标签，以及移动速度和画面质量设置。设置保存在当前浏览器。
- **本地场景维护**：调整植物、设施和道路，支持变换、复制、删除、撤销、重做和 JSON 导出。

场景用于校园外观与空间关系展示。建模脚本使用尺寸图坐标和照片参考，部分高度及不可见立面为估算，不属于实测测绘成果。

## 环境与启动

开发和构建需要 Node.js 与 npm。按当前 Vite 依赖的运行要求，使用 Node.js **20.19+（20.x）或 22.12+**；项目的 Pages 工作流使用 Node.js 22。

在项目根目录执行：

```sh
npm ci
npx playwright install chromium
npm run dev
```

打开 <http://localhost:5173/>。开发服务固定使用 `5173` 端口，端口被占用时会启动失败。Chromium 用于构建时生成编辑器素材预览，以及运行浏览器测试。

Windows PowerShell 若因执行策略阻止 `npm.ps1` 或 `npx.ps1`，可将命令中的 `npm`、`npx` 分别替换为 `npm.cmd`、`npx.cmd`。

开发服务器将 `/` 和 `/index.html` 映射到源码入口 `index.dev.html`。编辑页面的开发入口为 <http://localhost:5173/index.edit.html>，实际读取 `index.edit.dev.html`。

仅浏览已有完整静态构建时，无需安装 Node.js，直接打开项目根目录的 `index.html` 即可。复制或移动时需要保留同目录下的资源文件夹，不能只复制 HTML。

## 浏览操作

| 操作 | 方式 |
| --- | --- |
| 平移鸟瞰相机 | `WASD` 或方向键 |
| 临时加速 | 按住 `Shift` |
| 旋转视角 | 鼠标拖动 |
| 缩放 | 鼠标滚轮 |
| 鼠标平移 | 右键拖动 |
| 定位地点 | 点击地点列表、导览图圆点或已开启的建筑标签 |
| 触屏移动 | 按住左下角方向按钮，松开停止 |

在设置中可调整移动速度、切换画面质量及开启建筑标签。性能不足时选择流畅模式，降低渲染分辨率并关闭阴影。

## 构建与离线打开

```sh
npm run build
```

完整构建会依次生成场景索引、道具资源包、编辑器素材预览、校园数据脚本和模型脚本包，再构建游客页面与协作模块，最后将 `dist/` 中的静态资源同步到项目根目录。

构建完成后可以：

- 双击根目录 `index.html` 离线浏览。
- 将 `dist/` 作为静态站点目录托管。
- 执行 `npm run preview`，通过 Vite 预览构建产物。

项目通过普通脚本和相对资源路径适配 `file://`：校园数据提供 `campus.js`，模型提供 `campus.glb.gz.js` 与 Base64 备用包，避免离线页面依赖模块脚本或直接请求 JSON/GLB。模型压缩包优先使用浏览器的 `DecompressionStream` 解压。

**构建会更新生成的数据文件，并替换根目录中的静态资源副本。** 修改源码请使用 `src/`、开发入口及 `public/` 下的源资源；不要把根目录的构建产物当作源文件维护。仅修改源数据后，仍需重新构建才能更新离线页面。

## 本地编辑

独立编辑页用于本地维护，不需要协作账号。开发时运行 `npm run dev`，访问 `/index.edit.html`。

需要生成可直接打开的独立编辑页时：

```sh
npm run build
npm run build:edit
```

之后打开根目录 `index.edit.html` 或 `index_edit.html`。编辑页构建复用游客构建的共享资源，因此需要先完成游客构建。

编辑器支持植物与设施放置、位置/旋转/缩放调整、多选、复制、删除，以及道路绘制和路点调整。常用快捷键：

| 操作 | 快捷键 |
| --- | --- |
| 移动、旋转、缩放工具 | `G`、`T`、`Y` |
| 撤销 | `Ctrl+Z` |
| 重做 | `Ctrl+Shift+Z` 或 `Ctrl+Y` |
| 复制选中对象 | `Ctrl+D` |
| 相机移动 | `WASD` |
| 相机升降 | `E` / `Q` |

“保存到 public/data”在开发服务器下通过 `/__planting-edits` 写入 `public/data/planting-edits.json`。离线打开或使用普通静态服务器时没有写盘接口，保存会改为下载 JSON；将下载文件放回该路径并重新构建，才能更新游客页面。

常规 `npm run build` 不会把独立本地编辑页加入游客构建；只有 `build:edit` 明确执行额外同步。

## 在线协作

游客页的“设置 → 进入编辑模式”按需加载 `assets/editor-collaboration.js`。使用前需要配置服务：

1. 将 `.env.example` 复制为本地 `.env`，填写下面两个变量，然后重新构建。
2. 在目标 Supabase 项目中应用 `supabase/migrations/` 内的迁移，并部署 `supabase/functions/` 内的函数。
3. 配置匿名登录供邀请兑换使用，为管理者建立 Auth 账号及启用的 `owner` 协作者记录，并使数据库内的已发布状态与站点版本一致。
4. Owner 登录后创建一次性邀请，受邀用户通过链接填写昵称加入。

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

这两个值会进入浏览器构建。配置校验接受 publishable key 或兼容的 anon key，拒绝服务端密钥。函数所需的服务端配置由部署环境提供，不应放入 `VITE_` 变量。

协作实现包括：

- `AuthManager`：Owner 邮箱密码登录、匿名会话与邀请兑换。
- `EntityLockManager`：编辑对象前申请锁，维护锁状态及失效处理。
- `RealtimeManager`：私有频道中的在线成员与拖动预览。
- `CollaborationManager`：快照同步、修改提交和冲突处理。
- `HistoryManager`：编辑记录、撤销/重做与发布候选。
- `VersionManager`：核对布局哈希和已发布版本；版本变化时要求刷新。
- `AdminManager`：创建邀请、启停协作者及移出协作会话。

协作修改进入共享 **Draft**，不会直接改变游客使用的 **Published** 场景。Owner 导出的 `Planting-Edits-r<revision>.json` 带有 `meta.publishedRevision`；将其作为 `public/data/planting-edits.json` 纳入源项目、重新构建并部署，部署同步完成后才更新后台 Published 状态。

离线游客页仍可浏览校园，但协作入口需要通过 HTTP/HTTPS 加载清单、索引并连接服务。

## 静态部署与 GitHub Pages

`.github/workflows/pages.yml` 在 `main` 推送或手动触发时部署。该工作流面向**已经包含完整静态产物的仓库**，不会执行 `npm ci` 或 `npm run build`。

部署时，`scripts/deployment-sync.mjs` 为清单写入当前提交标识，校验场景索引与编辑数据，再将允许发布的文件整理到 Pages 产物目录。源码、工具目录及 Supabase 服务端文件不进入该产物。

如需在 Pages 发布成功后同步协作版本，配置 GitHub Actions secrets：

| Secret | 用途 |
| --- | --- |
| `SUPABASE_DEPLOYMENT_SYNC_URL` | `deployment-sync` Edge Function 的地址 |
| `DEPLOYMENT_SECRET` | 调用部署同步接口的专用密钥 |

Edge Function 使用 `DEPLOYMENT_SYNC_SECRET` 校验该密钥，并使用 `PUBLISHED_SITE_URL` 读取站点发布文件进行核对。工作流会等待公开站点提供当前提交的清单后再通知后台。两个 Actions secrets 都未配置时，站点仍可部署，协作版本同步会跳过。

## 项目结构

```text
src/
  main.js                 游客界面、导航、设置与协作入口
  scene.js                Three.js 场景、资源加载与相机控制
  scene-props.js          植物和设施生成、编辑数据应用
  scene-roads.js          道路与路点编辑
  scene-lotus.js          荷花及周边景观
  world-math.js           地形、边界与碰撞计算
  edit/                   独立本地编辑器
  editor/                 在线协作编辑器与管理模块
public/
  data/                   校园源数据、编辑覆盖数据和场景索引
  models/                 校园 GLB、独立模型及道具模型
  photos/                 景点照片与参考图片
  textures/               材质贴图
  fonts/                  本地字体
  editor-previews/        构建生成的素材预览图
blender/                  Blender 场景文件
scripts/                  建模、资源打包、构建、部署与检查脚本
supabase/
  migrations/             协作数据库结构、权限和 RPC
  functions/              邀请创建、兑换与部署同步
tests/                    逻辑测试及浏览器检查脚本
index.dev.html            游客源码入口
index.edit.dev.html       本地编辑器源码入口
vite.config.js            游客构建、开发路由与本地保存接口
vite.edit.config.js       本地编辑页构建
vite.editor.config.js     在线协作模块构建
```

`public/data/campus.json` 描述建筑、景点、道路、水体、植物及平面坐标等基础数据；`planting-edits.json` 保存对象与道路的覆盖修改。`scene-index.json` 为协作对象提供稳定索引，`scene-manifest.json` 记录提交标识、布局哈希和发布版本。

## 模型重建

前端构建直接使用现有模型，不要求安装 Blender。需要从脚本重建校园模型时，使用 Blender 4.5+，在项目根目录执行：

```sh
blender --background --python scripts/build_campus.py
npm run build
```

建模脚本读取校园数据，并调用各建筑与景观模块，导出独立 GLB 和合并的 `public/models/campus.glb`，同时保存 `blender/hepu-campus.blend` 与模型报告。该过程会重写对应输出，执行前应保存已有模型修改。

## 检查命令

```sh
npm test
npm run test:static
```

- `npm test` 使用 Node.js 测试运行器，覆盖导航与几何约束、编辑器状态与变换、协作逻辑、数据库 RPC 和部署流程等。
- `npm run test:static` 需要完整构建及 Chromium，通过 `file://` 打开根目录页面，检查三维场景能否就绪、资源路径是否正确及是否出现网络请求。

`tests/` 和 `scripts/` 下还保留了针对页面操作、模型和渲染的专用检查脚本；运行前应查看各脚本的入口参数和环境要求。
