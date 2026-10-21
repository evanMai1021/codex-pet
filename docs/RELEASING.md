# 构建和发布

仓库代码、插件声明和设置页面统一为 0.1.10。GitHub Release 标签建议为 v0.1.10；发布说明注明当前兼容范围与审批等待尚未完整覆盖。源码和便携包是两个独立下载项。

构建前在仓库运行 npm install。准备一个仅包含 Python 3.12 runtime 的独立目录，含 python.exe、Python DLL、Lib、DLLs、LICENSE.txt，不含虚拟环境、site-packages、用户配置或凭据。不要把自己的整个 Python 工作目录作为参数。

```powershell
python scripts/build_portable.py --python-runtime '你的独立Python运行库目录'
```

脚本只创建新的 dist/inori-codex-pet-v0.1.10 和 ZIP，已存在时拒绝覆盖。它保留 Electron 和 Python 的许可证，不下载依赖、不连接账户。便携版配置在 resources/run-data。

检查：运行 npm test、python scripts/validate_assets.py src/inori/assets/redwhite，并实际启动构建后的程序检查默认角色和设置版本。窗口自动回归可用本机 Electron 执行 tests/free-edge-regression.cjs；设置 INORI_DATA_DIR 和 INORI_TEST_OUT 为单独的临时目录。模拟界面通过不代表真实审批通过。

上传前只选择此独立仓库目录：确认没有 run-data、node_modules、runtime、数据库、凭据或个人绝对路径。不要上传上级版本归档。构建 ZIP 作为 Release 附件，不放进源码 Git 历史。

README 中默认素材的用途与代码许可分别说明。GitHub 公开仓库与 OpenAI 公共插件目录上架是不同操作，本次准备不会自动完成任意一种。
