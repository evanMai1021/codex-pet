---
name: pet-settings
description: 在 Codex 内调整楪祈桌宠的服装、显示、大小、趴边、减少动态、随启动及任务气泡设置。
---

调用本插件 pet_control_panel，在 Codex 内显示完整设置面板。直接使用面板控件，不打开独立设置窗口。需要显示公仔时用 pet_open。pet_open_settings 保留为内嵌面板的兼容入口。

用户明确要求修改某项时，可调用 pet_settings_update，传入 set 对象；仅设置用户要求的字段，其他值不变。读取用 pet_settings_read。气泡语句预览来自运行时，不编造审批状态或内部思考内容。

桌宠未启动且未主动退出时，设置接口连接后台实例，不主动显示公仔；主动退出后只读取保存的偏好，不启动后台。显示需要“打开宠物”或 visible 开关。插件面板所有修改立即应用并自动保存。随 Codex 启动不添加开机启动项。

如提示未配置位置，显示版本更新区域；用户要求安装时调用 pet_update_install，进度调用 pet_update_status。仅查询更新用 pet_update_check，不自动下载。也可按随包说明手动配置 exe；不读取凭据或 Codex 安装目录。

制作新角色使用 create-codex-pet Skill；内置服装选择不表示支持运行时导入任意角色包。

用户要求退出宠物时调用pet_quit：停止公仔、设置窗口及桌宠后台查询。用户已退出后，pet_settings_read只读取保存偏好，不启动后台；设置面板显示已退出，其他设置暂禁用。本次会话内，仅用户明确点击打开宠物或请求显示时调用pet_open恢复。隐藏仍使用visible=false，不把隐藏当退出；保留随启动偏好，但手动退出只对本次Codex会话优先；若随启动开启，下次Codex启动时自动恢复。

气泡位置设置：bubblePosition选择auto/left/right/top/bottom；bubbleOffsetX、bubbleOffsetY为-400到400的微调值，负数向左/上、正数向右/下。恢复默认一次提交{bubblePosition:"auto",bubbleOffsetX:0,bubbleOffsetY:0}。位置相对公仔，空间不足时避让，不保证始终固定在指定侧。

气泡常驻：bubblePinnedPage可选off/task/quota/usage。空闲显示选定页，有新鲜活动任务时自动切到任务页，结束后回到常驻页。常驻独立于bubbleEnabled，关闭气泡会同时设bubblePinnedPage=off及bubbleEnabled=false。不要为了展示常驻设置而打开独立设置窗口；使用Codex内插件面板，并核对宿主实际重载。
