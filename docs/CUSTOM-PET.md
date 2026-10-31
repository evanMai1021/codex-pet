# 制作自己的公仔与新动作

两套内置服装可以直接在设置中选择。自制角色目前采用“兼容素材包＋独立源码副本”的方式；没有通用的运行时角色导入按钮。别人可以替换已有动作，也可以修改源码增加新的互动动作。

## 给Codex使用的Skill

- [完整Skill目录](../plugins/codex-pet/skills/create-codex-pet)：包括SKILL.md和references，使用时保留整个文件夹。
- [下载独立Skill包](https://github.com/evanMai1021/codex-pet/releases/latest/download/create-codex-pet-skill.zip)：解压后得到create-codex-pet目录，按你的AI工具支持的Skill安装方式添加；仅下载ZIP不代表已经安装。
- 不支持Skill的AI：把SKILL.md及任务所需references交给它，并提供项目源码位置。纯聊天AI只能交付提示词、素材和步骤，不能声称已修改本机文件。

独立Skill包可单独更新；已发布插件ZIP中的内置Skill可能早于本页，应以仓库当前Skill和独立包为准。更新说明或Skill不会自动更换用户的桌宠程序。

在Codex中可这样请求：

```text
使用 $create-codex-pet 为我适配自己的角色。先阅读项目源码和参考图，
保留默认角色及当前运行版，先交付待机和挥手小样、清单与检查结果。
如果需要AI生成视频，先给我逐动作需求和可复制提示词，由我选择生成工具。
```

新增动作可以这样请求：

```text
使用 $create-codex-pet 增加一个“点头”互动动作，动作ID为nod。
先说明触发入口、单次时长、结束后回到哪个状态、PNG回退和必要代码改动。
在独立副本验证，不把素材文件存在当成动作已接入，不覆盖当前运行版。
```

## 图集与视频

1. 准备有权使用的全身参考图，先固定服装、脸部大小和脚底锚点。
2. 先做待机、一次互动的小样，再补齐其他状态。PNG和视频均需实际查看，不能只改扩展名。
3. [图集/清单格式](../plugins/codex-pet/skills/create-codex-pet/references/asset-format.md)说明裁切、回退、视频几何及必要帧槽位。
4. [视频制作流程](../plugins/codex-pet/skills/create-codex-pet/references/ai-video.md)说明如何用豆包等AI生成、抠像、转码、验证和接入；[提示词模板](../plugins/codex-pet/skills/create-codex-pet/references/video-prompts.md)包含共同约束、16类动作和新动作示例。
5. [新增动作接入](../plugins/codex-pet/skills/create-codex-pet/references/actions.md)说明为什么除了清单还要改触发路由、时长和回退。

只有素材制作者可能需要FFmpeg等处理工具，普通桌宠用户不需要安装；本项目不会自动调用外部付费模型或上传参考图。

## 检查与应用

在源码根目录运行：

```powershell
python scripts/validate_assets.py '你的角色目录'
python scripts/validate_assets.py '你的角色目录' --export '一个不存在的新目录'
```

上述导出仅处理PNG和清单，含视频时另行复制清单引用的WebM并完成编码/Alpha检查。不要据此宣称完整视频包已验收。导出manifest.js默认使用InoriAssets；接入战斗服目录时，按该目录加载约定使用InoriBattleAssets。

在独立源码副本接入导出的角色后，运行npm start -- --no-bridge，验证透明边缘、脸部比例、动作触发与结束、减少动态、四边姿势、缩放、视频失败回退。接入内置目录时还应运行python scripts/validate_builtin_assets.py。校验器通过不等于动画美观或真实任务接入已通过。

改角色显示名或把新角色注册为第三个选择项，需要有限源码适配，不代表已有通用导入器。不要更改账户、工具身份或真实任务状态来配合画面；也不要覆盖唯一素材原件。
