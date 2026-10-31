# 扩展动作

先辨别用户需要的是替换已有动作、给现有状态增加变化，还是新增可独立触发的动作。当前不是把视频丢进目录就自动生成菜单的动作系统。

## 已有触发关系

| 类型 | 视频键 | 触发与结束方式 |
| --- | --- | --- |
| 状态 | idle、working、waiting、completed、error、interrupted、unknown | 来自真实状态；completed等短片是否循环以清单为准，不能改变实际状态 |
| 互动 | wave、peace | 当前单击互动选择，播放后回到当前真实状态 |
| 空闲阶段 | stretch、doze、sleepEnter、sleep | 由空闲时间轴决定，入睡过渡与睡眠循环分开 |
| 趴边 | dock-left、dock-right、dock-bottom | 相应停靠位置；顶部目前复用底部旋转，不另加一个无效键 |

以上是当前源码的路由，以目标仓库实际代码为准。不同服装可以提供不同画面，但状态意义应相同。

## 替换已有动作

在独立副本中保留动作键，替换对应PNG/视频、更新时长、循环标志和必要的显示几何，重新生成manifest.js。不要只更换文件名或文件扩展名。保留可用PNG回退。

## 新增动作示例：点头 nod

1. 在角色manifest的clips中定义nod图集，必要时提供frameMs、loop、reducedFrame；在videos.nod中增加可选视频和PNG回退。已有校验器允许额外clip，但不会自动触发它。
2. 明确触发方式，例如单击互动池、右键“点头”、快捷操作或新的空闲阶段。不要新增一个没有来源的“真实任务状态”。
3. 阅读`src/inori/renderer/animation.js`的interaction、duration、timedClip及sampleAsset。现有interaction仅包含固定动作分支，新增互动需要添加nod分支，或为它接入timedClip；仅添加stateMap.nod无法让聚合状态自动产生nod。
4. 阅读`renderer/app.js`的interaction、activeClick、overlayUntil、sample和videoKey选择。把nod加入实际选择/事件路由，使用与真实时长一致的结束时间，并保证videoKey能到达videos.nod。单次动作每次触发应有新的播放标识。
5. 若需要菜单入口，修改`main.cjs`菜单及对应preload/renderer事件；若提供插件设置项，再同步程序与插件schema、UI和校验。不要为了新增一个动作改动全部工具接口。
6. 如果新增的是空闲阶段，现有idlePhases只接受stretch、doze、sleep、sleepEnter；扩展新阶段时须一起修改时间轴、视频键选择和校验器，不能把不支持的键伪装成已支持。
7. 在源码副本检查动作真的可触发、结束后回到正确状态，减少动态时可用、缺失/解码失败时回退、连续点击不残留视频元素，切换服装/停靠/真实等待时不丢状态。

## 贡献交付

提交动作说明（ID、触发、时长、循环及回退）、必要素材、manifest.json/manifest.js和有限代码变更；说明素材来源及可分发范围。不要包含账户、原始生成聊天、参考图私人信息或本机配置。

如果只制作了画面而未修改路由，交付状态写“素材完成，触发接入未完成”。第三方角色在设置中成为新选项还需修改skins注册、资源加载目录与设置UI，不等于已有通用角色导入器。
