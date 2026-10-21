# 安装和启动

## 使用便携包

1. 在本项目 GitHub 仓库右侧点击 Releases，选择 v0.1.10 下的 Windows 便携 ZIP。仓库尚未发布时，此入口没有下载文件。
2. 解压到有写入权限的目录；不要直接在 ZIP 内运行程序。双击 `楪祈桌宠.exe`，应看到默认楪祈。
3. 右击公仔选择“打开楪祈设置”。没有看见公仔时先检查系统托盘菜单。

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

配置脚本只修改当前 Windows 用户的 CodexPet/runtime.json；已存在时先保留备份。之后重启 Codex，在插件目录选择“楪祈桌宠本地插件”来源，安装 Codex Pet，再在新本地聊天中请求“打开 Codex Pet 设置”。这会打开独立设置窗口。

命令或插件目录入口会随宿主版本变化；若不支持本地插件，仍可直接使用桌宠右键设置，不必修改 Codex 安装目录。来源：[OpenAI 官方插件打包文档](https://developers.openai.com/plugins/build/plugins)，核对日期 2026-10-21。

普通用户无需修改原始配置、提供密码或另填 API Key。
