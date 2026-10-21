---
name: pet-settings
description: 打开本项目 Windows 桌宠的图形设置窗口，管理显示、大小、允许趴边和减少动态。
---

调用本插件 pet_open_settings 工具，打开本机已经配置的桌宠设置；由用户使用控件管理。此工具只接受空参数，不创建角色或执行聊天任务。

若提示启动位置缺失，先阅读仓库 docs/INSTALL.md，让用户选择已安装桌宠 exe，再用 scripts/configure_plugin.py 配置。不查找或读取账号凭据。

设置为独立窗口，不会给 Codex 新增原生侧栏按钮。制作新角色时转到本插件 create-codex-pet Skill，不把固定角色下拉框说成可用的导入器。
