# 0.1.14 同版本修订更新

本轮仍为 0.1.14，修订为 2026103001。只有正式 Release 的附件完成同步后，才可按本文从 GitHub 更新；当前文件本身不代表已经发布。

## 新更新器

Release 正文须保留 `<!-- codex-pet-revision:2026103001 -->`。便携程序的 `resources/app/release-revision.json` 与插件根目录的同名文件必须匹配。新更新器检查两组件修订，并保存成功安装的两份 ZIP 的组合 SHA256 摘要；同版本更高修订或已安装附件摘要改变会提示更新。没有安装收据时不能凭空知道用户原 ZIP 的摘要，用修订比较。更高版本或更高修订的组件不会被自动降级。发布同版本新构建时应递增修订，不能只替换附件而省略标记。

下载仍须通过正式来源、声明大小及 SHA256 校验；解压后版本和修订不匹配则在停止旧程序前失败。更新程序保留旧目录，只迁移 settings.json，使用 Codex CLI 刷新插件，再逐文件核对 CLI 返回的安装目录。更新完成后重启宿主或新开聊天，当前聊天里的旧工具不保证即时换成新工具。

## 旧 0.1.14 的一次性手动升级

旧插件只比较版本号，不会因附件变化获得提示，必须先手动升级一次。不要依赖旧面板的“已是最新版本”。

1. 从本项目正式 Release 下载便携 ZIP、插件 ZIP、SHA256SUMS，核对 `Get-FileHash -Algorithm SHA256 '完整ZIP路径'` 与清单完全相同。该清单用于完整性核对，来源应是本项目正式发布页。
2. 将两个 ZIP 解压到新的独立目录，保留所有旧目录。退出桌宠，确认其进程结束。将旧 `resources/run-data/settings.json` 复制到新便携程序对应位置（先创建目录）；只复制该设置文件，不复制 settings-control.json、数据库或账户文件。
3. 用新插件 ZIP 中的安装辅助脚本更新插件。`新插件解压根目录` 指包含 `.agents` 和 `plugins` 的目录：

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File '新插件解压根目录\plugins\codex-pet\server\release-helpers.ps1' -Mode plugin -Source '新插件解压根目录'
   ```

   它保留既有 marketplace 来源。既有来源为 Git 工作副本或托管源时，需先将该来源正常同步到本轮发布提交；有本地未提交改动时先审查，不能强制覆盖。源未同步时内容核验会失败，不能宣称安装成功。脚本经 CLI 刷新，不手工写缓存、不卸载插件。
4. 在源码包根目录执行 `python scripts/configure_plugin.py '新便携目录\楪祈桌宠.exe'`，将插件指向新程序。此脚本会备份旧启动配置；自定义 CODEX_PET_HOME 的用户须加 `--config-dir '自己的配置目录'`。再打开新程序，检查服装、大小和气泡偏好。
5. 重新启动 Codex 或新开聊天，在插件面板检查版本与修订。两服装各16个视频条目；顶部趴边复用底部旋转。若失败，保留错误信息，使用旧程序和启动配置备份恢复，不删除任何目录。

## 验证边界

本轮将以 D 盘隔离 CODEX_HOME 验证同号 CLI 刷新、实际发布 ZIP 解压、设置迁移及窗口回归。真实账户、用户正在运行的 Codex 与现有插件安装不在隔离验收中；正式发布后还须实际下载并对照 SHA256，再确认线上更新链路。

Codex 的 marketplace 与本地缓存机制参考：[官方插件打包文档](https://developers.openai.com/plugins/build/plugins)。实际同版本刷新行为以本轮本机隔离 CLI 测试为证据，不将其推定为所有宿主版本的保证。
