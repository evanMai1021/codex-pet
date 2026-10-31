# 用豆包等AI生成桌宠视频

目标是得到能在桌面小尺寸稳定播放的角色动作，而不是电影镜头。先准备一张构图、服装、脸部比例正确的完整角色参考图，再逐个动作生成。普通生成视频通常还需抠像、对齐、转码和接入，不能直接改成.webm扩展名使用。

## 生成前需求单

每个动作记录：动作ID、角色/服装、参考图、动作过程、单次还是循环、目标时长、背景颜色、取景范围、禁止变化、回退图集及触发方式。对待机与一次挥手先做小样，确定画风和锚点后再批量做其他动作。

- 镜头固定、全身、主体居中，头发、手指、裙摆和脚均留安全边距。不要运镜、缩放、切镜、字幕或场景变化。
- 保持脸大小、眼睛、发色、服饰细节与脚底位置，动作幅度以小尺寸仍能辨认为准。
- 循环动作要求首尾姿态、亮度与背景一致；单次动作说明起始、中间、结束姿态，不用无限重复来冒充一次动作。
- 常规动作与左/右/底部趴边应分别给相应构图参考。顶部是否旋转复用底部由项目实现决定，不让AI凭空画一份后声称自动接入。
- 若工具不能输出真实透明视频，选择与角色颜色明显不同的均匀纯色背景。绿色服饰/眼睛等不能用绿幕；可选其他颜色或使用前景分割。棋盘格不是透明通道。

建议生成原片不少于约576×624，后处理可整理为当前工程常用的576×624、24fps；这是一种适配目标，不是豆包所有入口都提供的参数。生成器若只支持其他比例/时长，先按可用参数生成，再裁剪时间、等比缩放与透明补边，不能拉伸人物。

## 在豆包或其他图生视频工具中的操作

1. 进入该工具实际提供的图生视频/参考图生视频入口，上传用户允许使用的参考图。只有文生视频时，优先先完成角色定稿，不承诺跨片角色一致。
2. 从[提示词模板](video-prompts.md)复制共同约束和一个动作要求，填写角色、背景颜色与时长。每条只做一个动作。
3. 若当前入口提供首尾帧控制，可为循环提供一致的参考姿态；仍须检查实际首尾接缝，不把参数选中当作循环成功。
4. 下载实际视频原文件，命名为例如idle-original.mp4，并记录生成工具、日期、动作要求与来源许可；不要上传生成账户、Cookie或私人生成聊天。
5. 检查完整角色、画风、脸大小、手指数、背景均匀度和镜头是否稳定。明显失败先重做，不靠重度去绿或模糊掩盖缺手、变脸和漂移。

豆包客户端、即梦与火山方舟API不是同一个入口，按钮、额度、付费与模型支持可能不同。不要假定每个账户都有某个模型或透明输出选项。经官方资料核对，Seedance提供图生视频及部分模型的首尾帧能力；具体能力以选择的入口和模型为准：[视频生成教程](https://docs.volcengine.com/docs/ark/video-generation-tutorial?lang=zh)、[任务API与能力说明](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh)。本项目不自动调用外部AI，也不代收生成费用。

## 后处理与透明度

素材制作者可选用FFmpeg（本地视频处理工具）及抠像软件，普通桌宠用户不必安装。先用`ffmpeg -version`和`ffprobe -version`确认本机可用；不要擅自安装依赖。

下面是命令模板，本次文档更新未实际执行这些视频转换；实际输入格式、颜色和工具编译能力需要核对。输出使用`-n`避免覆盖已有文件。

已有真实Alpha透明输入的转码示例：

```powershell
ffmpeg -n -i input-with-alpha.mov -an -vf "fps=24,scale=576:624:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuva420p,pad=576:624:(ow-iw)/2:(oh-ih)/2:color=black@0" -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 0 -crf 20 idle.webm
```

均匀绿幕原片可先用RGB色键抠像，参数只能作为起点：

```powershell
ffmpeg -n -i idle-original.mp4 -an -vf "format=rgba,colorkey=0x00FF00:0.12:0.05,fps=24,scale=576:624:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=576:624:(ow-iw)/2:(oh-ih)/2:color=black@0,format=yuva420p" -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 0 -crf 20 idle.webm
```

这不保证头发和手指能一次抠干净。出现发丝误删、残绿、重影或颜色污染时，应调整色键、做前景遮罩/分割或重生成原片，而不是提高阈值直到人物也被抹掉。背景不均匀或角色含背景同色时不适合简单色键。

检查流信息：

```powershell
ffprobe -v error -show_entries stream=codec_name,width,height,avg_frame_rate,pix_fmt:stream_tags=alpha_mode -show_entries format=duration -of json idle.webm
ffmpeg -n -c:v libvpx-vp9 -i idle.webm -frames:v 1 -vf alphaextract alpha-check.png
```

VP9解码器可能把pix_fmt显示为yuv420p，不能只凭该字段或alpha_mode标记判定有无真实透明内容。应强制支持Alpha的解码路径检查遮罩，并在实际Electron窗口、浅色和深色背景下查看。遮罩全白通常意味着没有抠出背景；第一帧正确也不能证明整段边缘合格。FFmpeg编码/滤镜能力依安装构建而异，详见[官方滤镜说明](https://ffmpeg.org/ffmpeg-filters.html)与[编码器说明](https://ffmpeg.org/ffmpeg-codecs.html)。

## 接入项目

WebM放入角色目录的videos子目录，并在manifest.json的videos中登记。更新由JSON生成的manifest.js，保留PNG回退。文件名使用ASCII字母、数字、短横线或下划线，路径以相对目录表示。

运行`python scripts/validate_assets.py <角色目录>`检查PNG结构。含视频的包须另行复制视频：现有`--export`不会复制WebM。两套内置角色接入后运行`python scripts/validate_builtin_assets.py`，它检查文件与基本时序，不验证VP9编码、真实透明通道、循环接缝或视觉质量。最后在独立源码副本运行`npm start -- --no-bridge`，检查动作选择、首尾、结束停留、PNG回退、减少动态、缩放和四边停靠。
