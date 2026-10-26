---
name: pet-settings
description: 在 Codex 内调整楪祈桌宠的服装、显示、大小、趴边、减少动态、随启动及任务气泡设置。
---

调用本插件 pet_control_panel，在 Codex 内显示完整设置面板。直接使用面板控件，不打开独立设置窗口。需要显示公仔时用 pet_open。pet_open_settings 保留为内嵌面板的兼容入口。

用户明确要求修改某项时，可调用 pet_settings_update，传入 set 对象；仅设置用户要求的字段，其他值不变。读取用 pet_settings_read。气泡语句预览来自运行时，不编造审批状态或内部思考内容。

桌宠未启动时，设置接口连接后台实例，不主动显示公仔；显示需要“打开宠物”或 visible 开关。插件面板所有修改立即应用并自动保存。随 Codex 启动不添加开机启动项。

如提示未配置位置，显示版本更新区域；用户要求安装时调用 pet_update_install，进度调用 pet_update_status。仅查询更新用 pet_update_check，不自动下载。也可按随包说明手动配置 exe；不读取凭据或 Codex 安装目录。

制作新角色使用 create-codex-pet Skill；内置服装选择不表示支持运行时导入任意角色包。
