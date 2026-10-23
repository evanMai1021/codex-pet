# 构建和发布

仓库代码、插件声明和设置页面统一为 0.1.12。GitHub Release 标签建议为 v0.1.12；发布说明注明当前兼容范围与审批等待尚未完整覆盖。源码和便携包是两个独立下载项。

构建前在仓库运行 npm install。准备一个仅包含 Python 3.12 runtime 的独立目录，含 python.exe、Python DLL、Lib、DLLs、LICENSE.txt，不含虚拟环境、site-packages、用户配置或凭据。不要把自己的整个 Python 工作目录作为参数。

```powershell
python scripts/build_portable.py --python-runtime '你的独立Python运行库目录'
```

脚本只创建新的 dist/inori-codex-pet-v0.1.12 和 ZIP，已存在时拒绝覆盖。它保留 Electron 和 Python 的许可证，不下载依赖、不连接账户。便携版配置在 resources/run-data。

检查：运行 npm test、python scripts/validate_assets.py src/inori/assets/redwhite，并实际启动构建后的程序检查默认角色和设置版本。窗口自动回归可用本机 Electron 执行 tests/free-edge-regression.cjs；设置 INORI_DATA_DIR 和 INORI_TEST_OUT 为单独的临时目录。模拟界面通过不代表真实审批通过。

上传前只选择此独立仓库目录：确认没有 run-data、node_modules、runtime、数据库、凭据或个人绝对路径。不要上传上级版本归档。构建 ZIP 作为 Release 附件，不放进源码 Git 历史。

README 中默认素材的用途与代码许可分别说明。GitHub 公开仓库与 OpenAI 公共插件目录上架是不同操作，请分别确认仓库上传、Release附件和插件目录上架状态。

## 标签触发自动发布

仓库包含 Windows 发布工作流。推送与 package.json 版本一致的 v 标签时，使用锁定的依赖执行逻辑和素材检查，再构建便携包及源码 ZIP，生成 SHA256 清单。附件上传完成后才将草稿 Release 发布。失败时查看 Actions 日志，不把排队或运行中当作已发布。

工作流复用 v0.1.10 已公开发布包内的独立 Python 运行库，下载后校验固定 SHA256，只提取 runtime/python，不包含用户数据。需要升级该运行库时，应另行核对来源、校验值和兼容性。官方 Actions 固定到提交，发布使用 GitHub 的临时工作流令牌，不需要维护者填写个人令牌。
