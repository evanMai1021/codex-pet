# 安装和启动

## 使用便携包

1. 在本项目 GitHub 仓库右侧点击 Releases，选择最新正式版本下的 Windows 便携 ZIP。仓库尚未发布时，此入口没有下载文件。
2. 解压到有写入权限的目录；不要直接在 ZIP 内运行程序。双击 `楪祈桌宠.exe`，应看到默认楪祈。
3. 在 Codex 插件面板调整完整设置；独立使用时运行 `楪祈桌宠.exe --settings`。没有托盘图标，隐藏后可再次启动 exe。

## 从源码运行

需要 Windows、带 npm 的 Node.js、Python 3.12，以及本机 Codex。源码启动需要下载固定版本 Electron；便携包用户不需要运行 npm。

在解压后的仓库文件夹打开 PowerShell，依次运行：

```powershell
python --version
node --version
npm --version
npm install
$env:INORI_PYTHON = (Get-Command python).Source
npm start
```

`npm install` 将依赖放在当前目录的 node_modules。预期启动默认楪祈；关闭时通过桌宠右键菜单退出。只检查界面而不连接本机状态：`npm start -- --no-bridge`。

## 可选：安装 Codex 设置插件

此插件通过本地 MCP（工具接口）打开已安装桌宠的设置，需要 `node` 在 PATH 中。先准备可执行便携包，然后在仓库根目录运行：

```powershell
python scripts/configure_plugin.py '你的完整路径\楪祈桌宠.exe'
codex plugin marketplace add .
```

配置脚本只修改当前用户的 CodexPet/runtime.json，并保留原配置备份。安装 Codex Pet 后，从插件详情或“楪祈桌宠设置”面板直接使用控件，所有设置在 Codex 内完成；“打开宠物”只显示公仔。不再用按钮跳转独立设置窗口。若仍显示旧内容，重新加载插件或新开聊天，使宿主加载更新后的工具。

命令或插件目录入口会随宿主版本变化；若不支持本地插件，仍可直接使用桌宠及 `--settings` 设置入口，不必修改 Codex 安装目录。来源：[OpenAI 官方插件打包文档](https://developers.openai.com/plugins/build/plugins)，核对日期 2026-10-21。

普通用户无需修改原始配置、提供密码或另填 API Key。
