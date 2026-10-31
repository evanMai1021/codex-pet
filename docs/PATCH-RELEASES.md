# 同版本补丁发布

本项目支持保持程序和插件版本为0.1.15，同时递增内部修订号。当前源码修订为2026103108。源码推送到main不会创建正式Release，首次发布仍需明确创建并推送v0.1.15标签。

## 每次补丁

1. 修复、验证后，同时更新根目录与plugins/codex-pet下的release-revision.json，使用更大的十位修订号，例如2026110101。package.json、package-lock.json及插件manifest继续保持0.1.15。
2. 更新CHANGELOG和docs/RELEASE-NOTES.md；Release说明只写更新内容及修订标记，安装步骤维护在README。标记须与程序和插件修订一致。
3. 提交源码后，在获得发布授权时，将v0.1.15标签移到该补丁提交。推送前读取远端标签原值，使用明确旧值的force-with-lease保护，不能覆盖他人的新标签。main始终正常推送，无需强推。
4. 由release工作流构建程序包、源码包、插件包及SHA256清单。更新已有v0.1.15 Release前转为草稿，附件全部替换成功后再公开，避免向更新器暴露混合修订。
5. 核对标签提交、修订标记、实际下载附件及摘要，验证旧版检查更新可以识别新修订。保留用户设置和至少一份可回退程序。

更新器同时比较语义版本、内部修订号及附件摘要。旧的0.1.15可收到较新修订；本地修订高于公开修订时，不应降级。仅修改说明不会让旧附件成为新补丁。

## GitHub限制

该流程要求Release允许修改。若仓库或组织启用了不可变发布（immutable releases），已公开Release的附件和标签不能替换，应改用新的补丁版本或独立发布标签，并调整更新器选择规则。不要在该限制下反复强推或删除Release来绕过保护。

官方依据：[管理Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)、[不可变发布](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)。
