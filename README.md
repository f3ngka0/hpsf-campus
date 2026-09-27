# 合浦师范校园云游

**直接双击项目根目录的 `index.html` 即可在浏览器中打开，无需启动服务器，也不依赖任何后端。**
所有资源（模型、照片、贴图、字体、数据）都是相对路径的本地文件，页面用 `file://` 协议加载。

拖动旋转、滚轮缩放；切换步行后使用 WASD / 方向键移动，Shift 加速，拖动环顾。到达景点按 E 收集纪念章。

要在开发模式下改代码，用 `start.bat` 或 `npm run dev` 启动 Vite，地址 http://localhost:5173 。

## 纯静态站点说明

项目根目录是一个**已经构建好、可直接打开**的静态站点。这些文件是构建产物（已被 `.gitignore` 忽略）：

| 路径 | 说明 |
| --- | --- |
| `index.html` | 生成的入口页，使用普通 `<script>`（非 ES module）与相对路径 |
| `assets/` | 主程序 JS 与自托管字体 |
| `data/` `models/` `photos/` `textures/` `fonts/` | 场景数据、模型、照片、贴图与字体 |
| `static-build.json` | 本次同步的文件数与字节数 |

为什么必须做这些改造（`file://` 的限制）：

1. **ES module 被 CORS 拦截。** `type="module"` 的脚本按跨域规则请求，而 `file://` 文档的源是 `null`，浏览器直接拒绝。因此构建产物用 Rollup 的 `iife` 格式输出，并用插件把 HTML 里的 `type="module" crossorigin` 改写成普通 `defer` 脚本。
2. **`crossorigin` 会连累样式表。** `<link rel="stylesheet" crossorigin>` 同样触发跨域检查而被拦截，插件会去掉该属性。
3. **`fetch` / `XMLHttpRequest` 不可用。** 两者都报 `URL scheme "file" is not supported`，所以校园数据改用 `data/campus.js` 以全局变量形式载入。
4. **GLB 模型经 `<script>` 载入。** 二进制无法从 `<script src>` 读回字节（只会得到一个没有来源信息的 `Script error.`），故打包为 `models/campus.glb.js`，内容是 base64 字符串，页面解码后交给 `GLTFLoader.parse()`。体积会增大约 1/3，但只在 `file://` 下才会走到这条路径；有服务器时仍正常流式加载 `campus.glb`。

源入口是 `index.dev.html`（引用 `/src/main.js` 的 ES module 页面）。`index.html` 是构建产物，不再纳入版本管理——若两者共用一个路径，每次构建都会污染工作区，而且上一次的产物会被当成下一次构建的输入，导致只生成 30 字节的空壳。

### 重新构建

```powershell
npm run build     # 生成数据脚本与 GLB 打包 → vite build → 同步到项目根目录
npm run clean     # 删除根目录的构建产物（不会动 index.dev.html 与源码）
npm run fonts     # 重新下载并自托管思源宋体（101 个子集，约 5.75 MB）
npm run test:static   # 用无头 Chromium 以 file:// 打开并逐项断言
```

`npm run test:static` 会核对场景就绪、12 个景点、模型与照片可加载、字体全部本地、无网络请求、无控制台错误。改完构建流程后应先跑它。

## 本轮修改

按最新红黄绿标注：删除亭前西侧不存在的南院长路，保留教学区接点以东的南院路；桥沿亭前灰色路接主路，湖东沿黄线补灰色沿岸路并接通南端。全图椅子全部取消，空地不再自动布置街道设施。东侧荷花池按完整水体边界密植荷叶和少量粉色荷花。东坡亭补白石苏轼坐像（简化雕塑）、照片位置的分层针叶树和灌木花坛。对应记录在 `lotusBeds`、`pavilionLandscape`，椅子清单 `benches` 为空。

2026-09-21 更新：实训楼入口幕墙、雨棚随新楼体坐标同步定位，树冠检查覆盖外挑构件；黑板报按用户黄色标注改为入口南侧与校园东侧的 L 形长廊。东坡井放回球场南侧绿地凹口，井台距主路边缘约 1.45 米。

植物按图示逐点登记：星形符号建为椰子树，实心圆冠建为普通树，教学楼庭院恢复普通树。建筑旁收小树冠，间距不足的符号保留在 `campus.json` 的 `unplacedPlanPlants` 中待核实。树高与冠幅仍是估算。

东坡亭按素材文件夹及用户补充航拍细化重檐灰瓦、屋脊装饰、白柱前廊、圆窗、花池；扁舟亭补三拱入口、侧拱廊和黄色山墙。饭堂方向的桥改为宽灰色铺装桥面与浅色栏杆，取消此前木桥材质与明显拱起，重新衔接亭前铺地。桥宽、栏杆和未标注细节按照片估计。东侧补荷叶，岸地覆盖完整建筑及台阶。删除全图按道路间距自动生成的密集路灯。

`public/photos/layout-source-overlay.jpg` 将现有模型轮廓反投影到原图，红线为建筑、蓝线为水体、灰线为亭前桥；编号对应 `public/data/placement-audit.json`。图纸中仅规划、而旧导览图显示为广场/平房的两处建筑单列为 `plannedBuildings`，没有当作已建楼体加入。

“模型合并失败”已修正：带有和不带有贴图坐标的模型分别分组合并，并保留逐块显示的后备方式。

- 以素材中的《校园平面图-尺寸8-1.pdf》为主要平面依据，修正 PDF 旋转后坐标，全部采用同一比例：每图面点 0.60021 米。没有使用高德 POI 定位。
- 体育馆改为约 44 × 22 米，跑道 CAD 外轮廓约 177 × 87 米。原先误用于操场的 143.52 米是东侧围墙标注。宽度采用矢量线条换算值，存在标注/读图差异时不冒充测量结果。
- 重建第二教学楼凹进、办公楼两侧凸出部分、艺术楼折线轮廓、南院综合楼 L 形，以及宿舍附属部分。
- 校门采用两侧各约 6 × 9 米的四层楼体，中间保留 7 米通道，并补入高拱、圆窗、学校名称和收起的伸缩门。
- 根据本地尺寸图重绘东侧道路转弯、湖岸、曲桥与堤道、院落、球场、铺地和绿化区域；取消缺少依据的南院两排平房及随机校外街屋。
- 三维模型、导览图与行走边界共用建筑轮廓。凹进位置不再用整块矩形阻挡；校门两侧楼体阻挡行走，中央通道开放。

## 交付文件

- `blender/hepu-campus.blend`：建筑、道路及地面分组保留的 Blender 工程。
- `public/models/campus.glb`：网页使用的完整场景；同目录另有各建筑及道路模型。
- `public/data/plan-overlay.svg`：供人工对照的重绘平面图，建筑鼠标提示包含依据说明。
- `public/photos/dimension-plan.jpg`：原始尺寸 PDF 第 1 页。
- `public/data/campus.json`：统一坐标、建筑轮廓、道路宽度和资料依据。

图纸标为“尺寸未定”的食堂等区域仍是示意轮廓。楼层高度、未拍到的立面、树木位置和湖岸高差为参考照片估算。尚未取得可靠 DEM，统一局部地坪不能视为真实海拔或完整测绘地形。

简单测试包括场景加载、8 个景点步行到达、桥面通行与高度、井台与道路间距、树冠与建筑间距、模型文件及浏览器错误检查。浏览器结果记录在 `reference/revision3/browser-report.json`；本轮模型检查图位于 `reference/revision4/`。

## 后续修改

平面修改集中在 `scripts/plan_layout.py`，楼体与校门细节在 `scripts/plan_models.py`。`prepare_site.py` 中的建筑列表提供照片及未标定区域的初始资料，最终位置与尺寸以 `plan_layout.py` 输出为准。

重新生成需 Python 的 Pillow、PyMuPDF、Shapely，以及项目附带的 Blender：

```powershell
python scripts/prepare_site.py
& '.tools/blender-4.5.3-windows-x64/blender.exe' --background --python scripts/build_campus.py
npm run build
```

`npm run build` 结束后，项目根目录就是可直接双击打开的静态站点；`dist/` 是同一份产物的中间目录，可原样部署到任意静态托管。

此次新增的定位核对逻辑位于 `scripts/verified_layout.py`；植物符号记录及配准矩阵在 `reference/revision3/`。若改换规划图，先重新运行 `register_source_plan.py` 和 `trace_plan_planting.py` 并查看标注图，再生成场景。`audit_plan_overlay.py` 生成原图叠加及逐栋编号记录。


## 亭子与荷花更新（revision 5）

- 东坡亭与扁舟亭按现场照片标注和三段 DJI 航拍重新组合。测得的门洞、前廊及回廊尺寸集中在 `scripts/pavilion_spec.py`，未标注的高度、遮挡部分和总体布局仍属估算，详见 `reference/revision5/pavilion-rebuild-research.md`。
- 墙柱碰撞、楼面标高和入口路线从同一尺寸数据生成；正门、两侧窄门可进入，低栏杆阻挡。模型文件也通过多高度射线检查，避免出现导航可走但模型挡路的情况。
- 荷花采用随机花丛与不同大小的浅粉花冠，当前3254朵花、574片叶；保留岸线和岛屿边界。
- `reference/revision5/` 保存鸟瞰、外观、室内截图和浏览器行走记录。运行 `npm test`、`node tests/pavilion-browser.mjs` 验证；浏览器测试需要先启动 `npm run dev`。


### 东侧建筑精细化（revision 6）

校门、实训大楼、艺术楼使用独立的照片参考模型（`scripts/east_models.py`）。校门重做石材分缝、内侧圆窗、连楼拱门和收拢伸缩门；实训楼按侧立面五层窗列重建，增加幕墙、顶部几何窗框、入口门廊、台阶、坡道、侧入口及屋顶水箱；艺术楼按五层长楼、四层楼梯翼和低层红瓦翼分开处理，并增加屋顶标语、竖排楼名和通信杆架。

`素材/实训大楼、校门、艺术楼` 中的 68 张图片全部收录，入口为侧栏“还原依据与地图来源”中的五组相册。`public/data/east-reference-inventory.json` 保存源文件、图片索引和 SHA-256；同内容的不同原文件保留各自记录。室内与周边资料不用于推断未确认的房间归属。三段 DJI 视频的抽帧检查资料位于 `reference/revision6`。

现有总平面坐标保留。层高、艺术楼分区界线、背面细部和屋顶设备尺寸仍属于照片估算；此轮为外观重建，没有新增楼内房间。

复现：`python scripts/prepare_site.py` → Blender 执行 `scripts/build_campus.py` → `npm run build`。检查：`npm test`、`node tests/east-campus-ui.mjs`、`node tests/controls-ui.mjs`。三栋模型对照渲染由 `scripts/render_revision6.py` 生成。

## 剩余建筑与环境精细化（campus-final-1）

已完成剩余24栋建筑、东坡井、湖心亭和田汉亭细节，以及树冠、低篱、草叶与岸线细节。9组367张照片加入资料页。全量生成使用相同模型函数，源数据准备保留已完成版本。

统一审查记录与精度说明：[reference/final-refine/README.md](reference/final-refine/README.md)。原有位置与树位不变；未确认的宿舍、住宅与后勤立面仍标注为估算。
