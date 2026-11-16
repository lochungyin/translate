# 随译 · Sui Translate

随译是一款支持跨应用划词翻译、截图翻译和文字识别的桌面软件，内置 Google 和有道翻译。

**v0.1.2** 将有道切换为官网游客文本翻译。内置 Google 和有道均可免 Key 使用。提供 Mac M 系列（arm64）安装包、Windows x64 安装包和免安装包。[下载 v0.1.2](https://github.com/lochungyin/translate/releases/tag/v0.1.2)

截图和划词需要系统权限。各平台与入口的验证范围见 [发布说明](docs/releases/v0.1.2.md) 和 [验证记录](docs/VALIDATION.md)。

## 功能

- 工作台输入翻译、Google / 有道并行结果、拖动调整服务顺序。
- 任意应用中的划词翻译、浮窗、固定窗口、全局快捷键。
- 截图翻译、系统 OCR、Tesseract OCR、二维码识别、图片输入。
- 剪贴板监听、自动复制、增量翻译、动态翻译、去除换行。
- 词典释义、音标、例句、Google 朗读。
- SQLite 本地历史、生词本导出、插件支持和备份。
- 浅色 / 深色 / 跟随系统，代理、字体和窗口偏好。
- 本地 HTTP 外部调用，默认端口 **60829**。

当前开发主机是 macOS，Windows 上的 WPS、全局快捷键和截图仍需在实际 Windows 设备上验收。

## 运行

需要 Node.js 20+、pnpm、Rust stable。Windows 需要 Microsoft C++ Build Tools 和 WebView2，macOS 需要 Xcode Command Line Tools。Debian 系 Linux 的系统依赖见 [构建脚本中的软件包清单](.github/actions/build-for-linux/entrypoint.sh)。

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
pnpm test           # 翻译请求与响应解析测试
pnpm build          # 前端生产构建
pnpm tauri build    # 为当前平台生成安装包
```

Windows 本机构建 `pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis -- --locked`，产物在 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`。Mac M 系列构建 `pnpm tauri build --target aarch64-apple-darwin --bundles app,dmg -- --locked`，产物在 `src-tauri/target/aarch64-apple-darwin/release/bundle/`。仓库提供手动触发的 Windows / macOS 构建工作流，使用锁文件并上传构建附件。

Windows 的 WebView2 要求、产物路径及交叉构建说明见 [Windows 使用说明](docs/WINDOWS.md)。

## 服务配置

打开「服务设置 → 翻译」，点击服务右侧的编辑图标。支持保存配置和单独测试连接。

**Google** 默认使用网页的 `MkEWBc` RPC 翻译接口，无需 API Key。默认地址为 `https://translate.google.com`，测试连接和 Google 检测共用相同协议、地址与 20 秒超时。支持多行文本。默认网页协议返回文本译文。需要旧接口词典结构或使用只实现旧接口的自定义服务时，可选择「旧兼容接口」。已有 `translate.googleapis.com` 地址继续默认使用旧协议。

内置 Google、有道、Google 检测与 Google 朗读共用原生网络客户端：关闭应用代理时直接连接，开启时使用应用中配置的 HTTP 代理。保存后下一次请求生效，已打开浮窗同样生效；不会自动继承系统/环境代理，也不会修改系统代理设置。备份及旧插件仍沿用原有客户端，代理修改可能需要重启。遇到 429、网页验证或重定向时会停止，不自动重试、切换接口或处理验证码。网页接口可能随服务商更新而变化。

**有道**使用 [有道官网游客文本翻译](https://fanyi.youdao.com/#/TextTranslate)，无需有道账号、应用 ID 或 API Key。已有服务实例可直接使用，应用会从当前配置中清除旧有道应用 ID 和密钥，并保留实例名称和启用状态。服务设置提供「测试连接」。可用语种以游客版为准，结果为文本译文。原智云接口特有的语种和结构化词典释义随旧接入停用。服务限流、要求登录或请求失败时，应用会显示相应原因。

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

应用标识为 `com.lochungyin.sui.translate`，配置和历史保存在当前用户的应用数据目录。配置文件未加密，可能包含代理或插件的凭据。旧版备份也可能保留有道凭据，请勿共享或提交到 Git。

应用运行后：

```sh
curl -X POST http://127.0.0.1:60829/translate --data 'Hello, world.'
curl http://127.0.0.1:60829/selection_translate
curl http://127.0.0.1:60829/input_translate
curl http://127.0.0.1:60829/ocr_translate
curl http://127.0.0.1:60829/ocr_recognize
curl http://127.0.0.1:60829/config
```

HTTP 接口触发桌面操作并返回 `ok`。使用外部截图时，把图片保存为应用缓存目录中的 `pot_screenshot_cut.png`，并在请求中添加 `?screenshot=false`。

## 来源与许可

随译基于 [Pot Desktop](https://github.com/pot-app/pot-desktop) 开发，保留上游版权，采用 [GPL-3.0-only](LICENSE) 许可。

[开发和验证记录](docs/VALIDATION.md)
