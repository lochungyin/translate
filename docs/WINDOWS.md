# Windows x64 使用与构建

适用：Intel / AMD 64 位 Windows 10 / 11。版本：0.1.1，包含 Google 当前网页 RPC、应用代理、界面布局及快捷翻译浮窗修复。安装包可从 [GitHub Release](https://github.com/lochungyin/translate/releases/tag/v0.1.1) 下载。

## 使用现成包

- 安装包：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/SuiTranslate_0.1.1_x64-setup.exe`。复制到 Windows 后运行，当前安装方式需要管理员权限；安装界面支持简体中文、繁体中文、英文。
- 免安装包：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/portable/SuiTranslate_0.1.1_x64-portable.zip`。完整解压后运行 `SuiTranslate/SuiTranslate.exe`。

运行应用无需 Node.js 或 Rust。应用需要 Microsoft Edge WebView2 Runtime；安装包内置引导程序，缺少 Runtime 时需要联网下载。免安装版需要预先安装 Runtime，可从 [微软官方网站](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) 下载。

Google 默认无需 Key。应用代理关闭时直接连接；若 Windows 网络需要代理访问 Google，在「常规设置 → 代理」填写当前代理客户端显示的 HTTP 主机及端口。有道仍需要应用 ID / 密钥，缺少有道配置不会阻止 Google 返回译文。

配置与历史保存在当前用户的应用数据目录 `com.lochungyin.sui.translate`。默认快捷键：`Alt+D` 划词翻译、`Alt+A` 输入浮窗、`Alt+S` 截图翻译、`Alt+O` 截图 OCR；本地 HTTP 端口为 `60829`。

## 已验证的范围

本机为 macOS arm64，通过 `cargo-xwin` 编译 Windows MSVC x64 Release，并用 NSIS 打包。已检查：

- 主程序是 PE32+ x86-64 GUI 应用，产品资源为 SuiTranslate。
- NSIS 压缩包完整性通过；提取的主程序 SHA-256 与编译输出一致。
- 安装包包含 WebView2 引导程序及语言选择插件，不再混入 macOS OCR 二进制。
- 免安装 ZIP 的 CRC 与内含主程序 SHA-256 检查通过，附使用说明、GPL 许可及校验文件。
- 导入表没有额外的 VC Redistributable DLL、Lingua DLL 或 WebView2Loader DLL 依赖。WebView2 Runtime 仍需要安装。
- 当前前端回归测试 12 项通过。

原始检查与最终产物 SHA-256 见 [windows-build-results.json](windows-build-results.json)。此版本未签名，尚未在 Windows 设备上实际启动；Windows 端 Google 在线翻译、WPS 划词、截图和系统 OCR 仍需实机验收。此前 macOS 在线成功记录保留在 [VALIDATION.md](VALIDATION.md)。

## 重新构建

Windows 本机构建沿用 `pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis -- --locked`，需要 Node.js / pnpm、Rust MSVC 工具链、Microsoft C++ Build Tools 与 WebView2。

当前 Mac 的交叉编译工具已安装，Rust 使用原有隔离目录，Windows SDK 和 cargo-xwin 缓存在 `~/.cache/codex-runtimes/sui-windows/`。SDK 许可已由用户在本次会话明确接受。复用命令：

```sh
SUI_WINDOWS_SDK_ACCEPTED=1 ./scripts/build-windows-cross.sh -- --locked
```

首次配置其他 Mac 时需安装 LLVM、LLD、NSIS、CMake、Ninja、cargo-xwin，并添加 Rust 目标 `x86_64-pc-windows-msvc`。使用 SDK 前请阅读 [Microsoft SDK 许可](https://go.microsoft.com/fwlink/?LinkId=2086102) 和 [cargo-xwin 说明](https://github.com/rust-cross/cargo-xwin)。

交叉构建脚本显式加载 `tauri.windows.conf.json`，覆盖宿主 Mac 的图标及资源列表。运行库链接由 Tauri 1 管理；不要再强制添加 `-C target-feature=+crt-static`，它会与 Tauri 1 的 UCRT 链接策略冲突。构建中的上游条件导入和 CRT 调试符号提示不影响本次 Release 产物生成。

构建不会提交、推送或发布代码。生成安装包后，免安装 ZIP 需从新的 `release/SuiTranslate.exe` 重新整理并检查校验值。
