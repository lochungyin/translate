# Windows x64 使用与构建

适用于 Intel 或 AMD x64 的 Windows 10 和 11。[下载 v0.1.2](https://github.com/lochungyin/translate/releases/tag/v0.1.2)

## 使用现成包

- 安装包：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/SuiTranslate_0.1.2_x64-setup.exe`。复制到 Windows 后运行，当前安装方式需要管理员权限；安装界面支持简体中文、繁体中文、英文。
- 免安装包：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/portable/SuiTranslate_0.1.2_x64-portable.zip`。完整解压后运行 `SuiTranslate/SuiTranslate.exe`。

运行应用无需 Node.js 或 Rust。应用需要 Microsoft Edge WebView2 Runtime；安装包内置引导程序，缺少 Runtime 时需要联网下载。免安装版需要预先安装 Runtime，可从 [微软官方网站](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) 下载。

Google 和有道翻译均无需 API Key。若网络需要代理，在「常规设置 → 代理」填写代理客户端的 HTTP 主机和端口。关闭应用代理时使用直连。

配置与历史保存在当前用户的应用数据目录 `com.lochungyin.sui.translate`。默认快捷键：`Alt+D` 划词翻译、`Alt+A` 输入浮窗、`Alt+S` 截图翻译、`Alt+O` 截图 OCR；本地 HTTP 端口为 `60829`。

## 已验证的范围

v0.1.2 的 Windows 包由 macOS arm64 通过 `cargo-xwin` 交叉构建，安装版使用 NSIS，两个版本均未进行 Windows 代码签名。实机启动、有道与 Google 在线翻译、WPS 划词、截图和系统 OCR 待验证。

下载文件的校验值见 [SHA256SUMS.txt](https://github.com/lochungyin/translate/releases/download/v0.1.2/SHA256SUMS.txt)。v0.1.1 的交叉构建检查保留在 [历史 Windows 检查记录](windows-build-results.json)。

## 重新构建

Windows 本机构建沿用 `pnpm tauri build --target x86_64-pc-windows-msvc --bundles nsis -- --locked`，需要 Node.js / pnpm、Rust MSVC 工具链、Microsoft C++ Build Tools 与 WebView2。

当前 Mac 的交叉编译工具已安装，Rust 使用原有隔离目录，Windows SDK 和 cargo-xwin 缓存在 `~/.cache/codex-runtimes/sui-windows/`。接受 SDK 许可后可运行：

```sh
SUI_WINDOWS_SDK_ACCEPTED=1 ./scripts/build-windows-cross.sh -- --locked
```

首次配置其他 Mac 时需安装 LLVM、LLD、NSIS、CMake、Ninja、cargo-xwin，并添加 Rust 目标 `x86_64-pc-windows-msvc`。使用 SDK 前请阅读 [Microsoft SDK 许可](https://go.microsoft.com/fwlink/?LinkId=2086102) 和 [cargo-xwin 说明](https://github.com/rust-cross/cargo-xwin)。

交叉构建脚本显式加载 `tauri.windows.conf.json`，覆盖宿主 Mac 的图标及资源列表。运行库链接由 Tauri 1 管理；不要再强制添加 `-C target-feature=+crt-static`，它会与 Tauri 1 的 UCRT 链接策略冲突。构建中的上游条件导入和 CRT 调试符号提示不影响本次 Release 产物生成。

构建不会提交、推送或发布代码。生成安装包后，免安装 ZIP 需从新的 `release/SuiTranslate.exe` 重新整理并检查校验值。
