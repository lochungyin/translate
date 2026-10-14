# 随译 · Sui Translate

基于 [Pot Desktop](https://github.com/pot-app/pot-desktop) 的个人跨应用翻译桌面软件。保留 Tauri / Rust 的原生交互，使用简洁的灰绿色界面。内置翻译服务仅提供 Google 和有道。

当前版本 **v0.1.1** 更新了工作台与浮窗布局、快捷键设置、划词错误提示和 macOS 应用包签名。安装包提供 **Windows x64** 与 **Mac M 系列（arm64）**，从 [GitHub Release](https://github.com/lochungyin/translate/releases/tag/v0.1.1) 下载。更新内容与验证范围见 [发布说明](docs/releases/v0.1.1.md)。

Google 在线翻译已修复；工作台、翻译浮窗和测试连接均已获得真实 Google 译文。有道需配置应用 ID / 密钥，截图和划词需要用户在系统设置中授予相应权限。详细验收边界见 [验证记录](docs/VALIDATION.md)。

## 功能

- 工作台输入翻译、Google / 有道并行结果、拖动调整服务顺序。
- 任意应用中的划词翻译、浮窗、固定窗口、全局快捷键。
- 截图翻译、系统 OCR、Tesseract OCR、二维码识别、图片输入。
- 剪贴板监听、自动复制、增量翻译、动态翻译、去除换行。
- 词典释义、音标、例句、Google 朗读。
- SQLite 本地历史、生词本导出、原有插件机制和备份。
- 浅色 / 深色 / 跟随系统，代理、字体和窗口偏好。
- 本地 HTTP 外部调用，默认端口 **60829**。

Windows、macOS 和 Linux 的原生功能沿用 Pot 实现。当前开发主机是 macOS，Windows 上的 WPS、全局快捷键和截图仍需在实际 Windows 设备上验收。

## 运行

需要 Node.js 20+、pnpm、Rust stable。Windows 需要 Microsoft C++ Build Tools 和 WebView2；macOS 需要 Xcode Command Line Tools；Linux 的系统依赖见 [Pot 原项目安装说明](https://github.com/pot-app/pot-desktop#手动编译)。

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
```

本次开发安装的 Rust 位于独立缓存中，当前机器可执行：

```sh
./scripts/dev-local.sh
```

`pnpm dev` 仅启动 Vite 资源服务。由于原生能力通过 Tauri IPC 调用，浏览器直接访问不会提供完整应用，请用 `pnpm tauri dev` 打开桌面窗口。

```sh
pnpm test           # 翻译响应解析与有道签名输入测试
pnpm build          # 前端生产构建
pnpm tauri build    # 为当前平台生成安装包
```

Windows 本机构建 `pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis -- --locked`，产物在 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`。Mac M 系列构建 `pnpm tauri build --target aarch64-apple-darwin --bundles app,dmg -- --locked`，产物在 `src-tauri/target/aarch64-apple-darwin/release/bundle/`。仓库提供手动触发的 Windows / macOS 构建工作流，使用锁文件并上传构建附件。

当前已在 Mac 上生成 **Windows x64 安装包与免安装 ZIP**，包含本次 Google 修复。文件位置、WebView2 要求及构建说明见 [Windows 使用说明](docs/WINDOWS.md)。包格式、依赖与完整性检查通过；实际 Windows 启动与 WPS 交互仍需实机验收。

## 服务配置

打开「服务设置 → 翻译」，点击服务右侧的编辑图标。支持保存配置和单独测试连接。

**Google**：默认使用当前网页的 `MkEWBc` RPC 翻译请求，不需要 API Key，仍是免费网页服务。当前网络中，Pot 原先的 `translate_a/single` 返回 429，而网页 RPC 返回 200 和真实译文。默认地址为 `https://translate.google.com`；测试连接和 Google 检测共用相同协议、地址与 20 秒超时。支持多行文本。默认网页协议返回文本译文；需要旧接口词典结构或兼容只实现旧接口的自定义服务时，可手动选择「旧兼容接口」。已有 `translate.googleapis.com` 地址继续默认使用旧协议。

内置 Google、有道、Google 检测与 Google 朗读共用原生网络客户端：关闭应用代理时直接连接，开启时使用应用中配置的 HTTP 代理。保存后下一次请求生效，已打开浮窗同样生效；不会自动继承系统/环境代理，也不会修改系统代理设置。备份及旧插件仍沿用原有客户端，代理修改可能需要重启。遇到 429、网页验证或重定向时会停止，不自动重试、切换接口或处理验证码。网页协议仍可能随 Google 更新而变化。

**有道**：使用 [有道智云文本翻译 API](https://ai.youdao.com/DOCSIRMA/html/trans/api/wbfy/index.html)，填写已开通文本翻译服务的应用 ID 和应用密钥。采用 v3 SHA-256 签名，通过 HTTPS 表单 POST 请求。未配置时会直接提示配置，不发送请求。

语言检测默认在本机执行，也可选择 Google。OCR 默认使用系统 OCR，另有 Tesseract 和二维码识别；不会默认调用第三方 OCR 服务。Tesseract 首次识别可能需要下载相应语言模型。朗读通过 Google 语音接口进行，词典自带的发音保留。

## 快捷键

| 操作 | 默认快捷键 |
| --- | --- |
| 划词翻译 | Alt+D |
| 浮窗输入翻译 | Alt+A |
| 截图翻译 | Alt+S |
| 截图 OCR | Alt+O |

在「热键设置」中修改。如果与其他软件冲突，应用会提示注册失败。macOS 划词需要辅助功能授权，截图需要系统允许屏幕录制；Windows 请实测 WPS 的选区读取。

## 本地数据与外部调用

应用标识为 `com.lochungyin.sui.translate`，配置和历史使用独立目录，不覆盖 Pot 数据。密钥保存在本机配置文件中，输入框隐藏显示；当前配置文件未加密，请勿共享配置文件或把它提交到 Git。

应用运行后：

```sh
curl -X POST http://127.0.0.1:60829/translate --data 'Hello, world.'
curl http://127.0.0.1:60829/selection_translate
curl http://127.0.0.1:60829/input_translate
curl http://127.0.0.1:60829/ocr_translate
curl http://127.0.0.1:60829/ocr_recognize
curl http://127.0.0.1:60829/config
```

HTTP 接口触发桌面操作并返回 `ok`，不是直接返回译文的翻译 API。外部截图可使用 `?screenshot=false`；图片放在本应用缓存目录的 `pot_screenshot_cut.png`，继续兼容 Pot 的文件协议。

## 来源与许可

派生自 Pot Desktop，基线提交 `594d32ede96acd106b0256deaa8bb440ffcdff40`。原项目说明保留在 [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md)，原作者版权和 [GPL-3.0 许可](LICENSE) 保留。该个人版本关闭了 Pot 的自动更新源，避免更新成上游应用。

[开发和验证记录](docs/VALIDATION.md)
