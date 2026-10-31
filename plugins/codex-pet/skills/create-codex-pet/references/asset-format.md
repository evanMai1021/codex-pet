# 素材格式与渲染约定

本项目使用 192×208 的 canvas（画布），图片存放在 src/inori/assets/redwhite。每个完整包包括 manifest.json、由它生成的 manifest.js，以及被引用的 PNG。manifest.js 必须仅包含 `globalThis.InoriAssets = <JSON>;`，不要从第三方包执行任意脚本。仓库素材检查脚本会从 JSON 重新生成 JS。

## 图集与帧

manifest.version 为 1。clips 是按动画名称组织的对象。每个条目有 image（PNG 文件名）、size（图集真实宽高）与 frames 数组。

每个 frame：

- source: [x, y, width, height]，图集中某一帧的完整矩形。
- box: [left, top, right, bottom]，相对此 source 的人物裁切范围；注意后两个值为右、下坐标，不能误写成宽高。
- draw: [x, y, width, height]，未裁切完整 source 映射到 192×208 画布的目标矩形。draw.x/y 可为负以移除空白。实际绘制会把 box 按 source→draw 的比例映射。
- 可选 image：指向 clips 或 additionalImages 中的图片键，可在一个动画内混用图集。省略时用该 clip 的 image。

例如一个单独 192×208 PNG 内人物范围是 [40,20,150,200]，整图原尺寸绘制的帧可以写成：

```json
{"source":[0,0,192,208],"box":[40,20,150,200],"draw":[0,0,192,208]}
```

这只是单帧说明，不是完整动画包。当前时间轴所需槽位：wave 16、peace 16、blink 8、working 8、waiting 8、completed 48、error 12、interrupted 8、unknown 8、stretch 12、sleep 12。复用帧可以满足静态显示，不能声称已绘制这么多张独立动作。

additionalImages 是 图片键→PNG文件名，例如 completedLanding、blinkAtlas、waveLift；只有帧实际引用时才需要对应键。为减少接入差异可保留默认映射结构。

## 趴边

dock.images 将图片键映射为 PNG 文件名。dock.poses 至少有 left/right/bottom；若 topDerivedFromBottom 为 true，上方由下方旋转180度派生，否则必须提供 top。

pose 的 source、box 与上面相同，但不用 draw；使用 face: [left,top,right,bottom]、正数 scale 和 imageKey。scale 控制人物缩放，face 用于脸部对齐/检查。省略 scale 时按 dock.targetFaceWidth 与 face 宽度计算。

当前 renderer/animation.js 中 dockLayout 负责靠边锚点，上方派生严格旋转下方，不能另画成站姿。修改素材时检查左/右手脚没有被屏幕边缘裁掉，额度条仍能显示；不要为适配素材改动整个窗口状态逻辑。

## 检查和交付

PNG 使用透明背景；避免格子边缘切到头发、手或脚。检查待机、互动最高点、完成动作落地、四边姿势、缩小/放大后脸部比例以及明暗桌面背景下的边缘。脚底和脸中心跨帧应稳定。

`python scripts/validate_assets.py <目录>` 检查 JSON 引用与几何范围；`--export <新目录>` 生成必要文件，拒绝覆盖已有目录。它不执行输入 manifest.js，不代替视觉检查，也不接入真实聊天。

## 可选透明视频

当前渲染器可按videos中的键选择WebM视频，PNG图集仍需保留以支持减少动态与解码失败回退。一个条目的示例：

```json
{"file":"videos/nod.webm","loop":false,"frameMs":41.6666666667,"durationMs":2400,"presentation":{"scale":1,"x":0,"y":0},"visibleBounds":[24,10,144,190]}
```

数值仅为结构示例，时长和可见范围必须按真实文件测量；不要复制示例几何冒充已对齐。frameMs为一帧的毫秒数，24fps约41.67ms。durationMs影响部分单次/睡眠过渡的结束判断；loop控制视频是否循环。presentation在逻辑192×208坐标系内定义额外缩放和位移；visibleBounds是同一逻辑坐标中的[x,y,width,height]，并非原视频像素框。

eyeAnchors等可选校准元数据只有实测后才填写。全局人物比例由渲染几何和视频布局共同决定，不能仅根据视频分辨率认为脸大小一致。当前常用视频为576×624、24fps、无音轨、VP9 WebM及真实Alpha透明通道，12:13对应逻辑画布的比例。

PNG导出脚本不会复制或检查WebM；含视频的导出包需要补齐实际引用的视频文件。视频键不会自动变成新的互动入口，见[动作扩展](actions.md)；生成、抠像与验证见[视频流程](ai-video.md)。
