# 构建和发布

仓库代码、插件声明和设置页面统一为 0.1.14。GitHub Release 标签建议为 v0.1.14；发布说明注明当前兼容范围与审批等待尚未完整覆盖。源码和便携包是两个独立下载项。

构建前在仓库运行 npm install。准备一个仅包含 Python 3.12 runtime 的独立目录，含 python.exe、Python DLL、Lib、DLLs、LICENSE.txt，不含虚拟环境、site-packages、用户配置或凭据。不要把自己的整个 Python 工作目录作为参数。

```powershell
python scripts/build_portable.py --python-runtime '你的独立Python运行库目录'
```

脚本只创建新的 dist/inori-codex-pet-v0.1.14 和 ZIP，已存在时拒绝覆盖。它保留 Electron 和 Python 的许可证，不下载依赖、不连接账户。便携版配置在 resources/run-data。

检查：运行 npm test、python scripts/validate_assets.py src/inori/assets/redwhite，并实际启动构建后的程序检查默认角色和设置版本。窗口自动回归可用本机 Electron 执行 tests/paged-bubble-regression.cjs；设置 INORI_DATA_DIR 和 INORI_TEST_OUT 为单独的临时目录。模拟界面通过不代表真实审批通过。

上传前只选择此独立仓库目录：确认没有 run-data、node_modules、runtime、数据库、凭据或个人绝对路径。不要上传上级版本归档。构建 ZIP 作为 Release 附件，不放进源码 Git 历史。

README 中默认素材的用途与代码许可分别说明。GitHub 公开仓库与 OpenAI 公共插件目录上架是不同操作，请分别确认仓库上传、Release附件和插件目录上架状态。

## 标签触发自动发布

仓库包含 Windows 发布工作流。推送与 package.json 版本一致的 v 标签时，使用锁定的依赖执行逻辑和素材检查，再构建便携包及源码 ZIP，生成 SHA256 清单。附件上传完成后才将草稿 Release 发布。失败时查看 Actions 日志，不把排队或运行中当作已发布。

工作流复用 v0.1.10 已公开发布包内的独立 Python 运行库，下载后校验固定 SHA256，只提取 runtime/python，不包含用户数据。需要升级该运行库时，应另行核对来源、校验值和兼容性。官方 Actions 固定到提交，发布使用 GitHub 的临时工作流令牌，不需要维护者填写个人令牌。

0.1.14 的当前窗口验收脚本为 paged-bubble、video-batch、video-sleep-dock、video-battle-batch、video-final-014、embedded-settings、corner-badge、monitor-seam、bubble-scale 和 pet-size-drift regression。保留的旧独立详情页回归用于历史参考，不作为分页气泡的验收入口。检查素材时使用 `python scripts/validate_builtin_assets.py`，同时验证 JSON/JS 一致性和视频引用。

本轮插件更新和退出修复统一为0.1.14，上一正式版为0.1.13。合并发布会重新生成对应附件和校验值；不改写 main 分支历史。整理清单只匹配指定旧标签的提交，避免影响将来使用相同版本号的新发布。

## 当前版与下一版的划分

视频图源替换、播放适配与相关比例定位修正继续并入0.1.14。下一版本暂定0.1.15，仅处于范围准备阶段，见[NEXT-0.1.15.md](NEXT-0.1.15.md)。当前package、插件、界面、构建版本保持0.1.14；尚未适配或发布的素材不能列为已完成。

2026-10-30本地补充验收：两套服装各16段视频。源码与运行包最终素材窗口回归各63项通过；战斗服批次77项、分页气泡22项、内嵌设置27项、Node 147项及Python 14项通过。当前GitHub附件尚未包含这次补充。本轮新增修订与附件摘要比较；旧0.1.14须先手动升级新插件，不能声称旧更新器会自动获得同号更新。详见[同版本更新说明](UPDATE-0.1.14-REVISION.md)。

## 同版本修订的本地发布准备

修订2026103001，版本仍为0.1.14。先用 `scripts/prepare_release_downloads.py` 从已审查工作树创建源码快照和插件ZIP，保留 source-inventory.json 供核对；它包含尚未提交的本轮素材，不能用旧 HEAD 的 git archive 代替。再从工作区的 `work/build_release.py --version 0.1.14 --public-project <source-tree完整路径> --python-runtime <独立运行库> --out-dir <独立暂存目录> --no-activate` 构建便携包；正在使用的 outputs/inori-codex-pet-v0.1.14 不覆盖。最后为三个ZIP生成SHA256清单并验收解压产物。

正式发布须另获明确要求。提交前逐文件核对快照和源码；不改写main历史。当前 workflow_dispatch 会检出旧版本标签，直接运行可能重新发布旧内容；须先核对标签指向与发布方案。标签是否调整单独决定，不能把 Release target_commitish 当成实际标签提交。当前源码ZIP是未提交快照，正式发布前应与最终提交逐文件核对；工作流重新打包会产生另一组ZIP摘要，不能沿用本地SHA256清单。

2026-10-30本轮发布使用已审查提交，main正常追加提交，v0.1.14标签通过指定旧提交的租约更新后触发Windows构建。线上附件重新构建后必须按新SHA256重新下载验收，不混用准备阶段的ZIP摘要。
