# 功能修复与验证记录

日期：2026-10-13（Asia/Shanghai）。测试主机：macOS aarch64。

## 当前结论

Google 在线翻译已修复并在真实 Tauri WebView 和重新打包的原生应用中验证。默认网页 RPC 返回 HTTP 200；工作台、浮窗和服务设置的测试连接均显示真实译文。有道尚未配置真实应用 ID / 密钥，独立列为未验收项。

此前「7 项原生冒烟通过、Google 429 和有道缺凭据阻塞」保留为历史证据；本次 Google 专项结果见 [google-live-results.json](google-live-results.json)，最终包检查见 [google-package-results.json](google-package-results.json)。没有使用模拟 Google 响应证明在线成功。

| 能力 | 实际结果与证据 |
| --- | --- |
| 主窗口输入翻译 | 最终包原生工作台输入 `Hello, world.`、Enter 提交，Google 返回并显示 `你好世界。`；请求 HTTP 200，应用代理关闭，原生客户端为 direct |
| 相同文本重试 / 清空 | 本次最终包浮窗对 `Good morning.` 再次提交，重新发出真实请求并再次显示 `早上好。`；此前清空会同时清空原文、结果、错误的验证保留 |
| 翻译浮窗 | 最终包原生浮窗输入 `Good morning.`，Google 真实返回 `早上好。` |
| Google 多行与语言检测 | 真实 Tauri WebView 将 `你好。\n今天是晴天。` 翻为 `Hello.\nIt's sunny.`；Google 检测英文句子返回 `en`，共用网页请求实现 |
| 系统 OCR | 真实 Tauri IPC 与原生 OCR 二进制成功识别固定测试图片中的 `Hello Sui Translate 2026 / Native OCR test`；通过 HTTP 图片协议打开识别窗口，UI 显示同样文字 |
| 截图翻译 / 截图 OCR | 本机随译没有屏幕录制权限；截图按钮显示明确权限提示，未进行实际屏幕捕获，也未授予权限 |
| 划词翻译 | 本机随译没有辅助功能权限；通过当前包 `/selection_translate` 实际触发后，原生界面显示缺失权限原因，未声称成功读取其他应用的选区 |
| 剪贴板监听 | 实际开启原生监控、写入测试文字，确认原生翻译状态收到相同文字并创建真实翻译窗口；随后关闭监听、恢复原剪贴板 |
| 朗读 | Google 真实请求返回 15,552 字节音频，WebKit 音频解码成功，24 kHz / 1.944 秒；不把“音频返回/解码成功”当作已人工听到扬声器声音 |
| 历史记录 | 真实 SQLite 隔离数据库验证“写入 → 清空 → 再写入 → 查询”；原生历史页面正常。因未获得真实译文，不声称已完成在线翻译自动入库验收 |
| 服务配置 | 原生 UI 修改并保存 Google 配置名称，列表及重新打开表单显示保存值；已打开并固定的同一翻译浮窗也更新为新名称，随后恢复名称；原生 Store 验证同步读取、等待保存、切换配置键 |
| 测试连接 | 最终包 Google 配置表单使用默认「当前网页接口」，原生 UI 显示 `连接成功 你好世界。`；有道缺少凭据时明确提示 |
| 快捷键 | 四个默认热键原生注册成功；原生测试验证冲突注册失败后，原有两个绑定均保留。自动化按键未触发全局快捷键，实体键盘触发仍待人工验收 |
| 外部 HTTP 调用 | `/translate` 与 `/input_translate` 返回 `ok` 并进入真实窗口流程；`/ocr_recognize?screenshot=false` 打开识别窗口并显示实际 OCR；未知路径 404，空文本 400 |
| Windows / WPS | 已交叉编译 Windows MSVC x64 Release，生成安装包及免安装 ZIP，PE 格式、依赖、NSIS / ZIP 完整性与主程序哈希检查通过；实际 Windows / WPS 运行仍待实机验收，见 [Windows 记录](WINDOWS.md) |
| Linux | 当前没有 Linux 验收环境，未进行实际运行测试 |

### 自动化与构建

- `pnpm test`：12 项响应解析、请求编码与签名输入测试通过；RPC 解析样本来自本次真实公开测试文字的 HTTP 响应。这些是回归测试，不作为在线成功证据。
- `cargo test --manifest-path src-tauri/Cargo.toml service_http::tests -- --test-threads=1`：3 项通过。使用实际本地 TCP 服务器验证代理 → 直连切换、缓存复用/更新、no_proxy 排除和不跟随验证重定向；本地传输探针没有冒充 Google 服务。
- 本次 Google 原生专项：4 项通过，包括英译中、多行中译英、Google 语言检测和真实音频解码，见 [google-live-results.json](google-live-results.json)。
- 此前原生冒烟检查：7 项通过，2 项受外部条件阻塞。原始结果见 [native-smoke-results.json](native-smoke-results.json)，其中 Google 429 已被本次专项验证更新；其他 OS 能力沿用此前证据，未宣称本次全部重测。
- `cargo check` 通过；后续最终打包再次编译了原生后端。
- `pnpm tauri build --debug --bundles app` 成功，产物：`src-tauri/target/debug/bundle/macos/SuiTranslate.app`。
- 构建仍有上游插件 `eval`、前端包体积、Browserslist 旧数据、Rust `block 0.1.6` 未来兼容性提示，当前构建通过。
- 生产资源构建通过 `import.meta.env.DEV` 排除了原生冒烟和 Google 专项脚本；实际检查打包资源不含 `GOOGLE_LIVE` 或 `google-live-results`。
- `docs/screenshots/` 来自上一轮前端模拟测试，不能证明在线翻译或原生能力成功。
- [google-live-screenshots/workspace.png](google-live-screenshots/workspace.png)、[connection-test.png](google-live-screenshots/connection-test.png)、[floating.png](google-live-screenshots/floating.png) 来自本次最终原生包的真实在线结果。

## Google 专项根因与修复（2026-10-13）

1. **请求协议不兼容当前服务行为。** 修复前在真实 Tauri WebView 中复现旧 `GET /translate_a/single` HTTP 429，同时真实 TTS 返回 15,552 字节并成功解码；证据见 [google-live-baseline.json](google-live-baseline.json)。对公开文字的受控 curl 请求也确认旧接口在显式直连和现有系统代理下均 429。用户确认浏览器网页正常翻译后，测试当前网页的 `POST /_/TranslateWebserverUi/data/batchexecute`、`rpcids=MkEWBc`，同一代理及显式直连均获得 HTTP 200 和译文。无需 Key、Cookie、登录会话、伪造版本参数或验证码。仅此结果不能确定 Google 内部为何对旧接口限流，但能够排除“整个 Google 不通”和“只需修正代理即可恢复旧接口”的笼统结论。
2. **关闭应用代理仍继承系统代理。** 本机 shell 没有代理环境变量；macOS 系统 HTTP/HTTPS 代理为 `127.0.0.1:7897`。修复前 `proxy_enable=false`，reqwest 原生日志仍记录该代理。已安装的 Tauri 1.8.1 HTTP 客户端默认读取平台代理，前端 `fetch` 在各 WebView 中缓存 defaultClient；旧 `unset_proxy` 只删除小写环境变量，不能关闭系统代理或重建缓存。改变环境变量后重启也不能让“关闭应用代理”变成明确直连。
3. **内置服务改用明确配置的原生客户端。** 新 `service_http` 在每次请求时读取唯一原生 Store 的代理快照；`.no_proxy()` 关闭自动环境/系统代理，开启时显式应用 HTTP 代理及排除列表。缓存以完整代理配置为键，变更后下一次请求重建，所有窗口共用。翻译、Google 检测、测试连接以及朗读/有道使用同一传输层；旧 `set_proxy/unset_proxy` 路径保留给备份与旧插件，内置服务不再依赖该路径或 Tauri 默认缓存。系统代理及当前应用代理配置均未改变。
4. **统一默认 Google 网页协议。** 翻译和检测共用 `googleRequest`、20 秒超时、同一启用的 Google 实例地址及协议；检测取当前服务列表中首个启用的 Google 实例。解析 XSSI 前缀、长度帧和 `MkEWBc` 数据，保留多行文本与检测语言。旧接口为手动兼容选项，没有遇到 429 后自动切换接口的逻辑。默认网页协议返回文本，不提供旧接口的词典结构；旧词典解析继续保留。
5. **验证限制不被当成成功。** 原生传输不自动跟随重定向，不自动重试 429；HTML、验证、空结果和异常 RPC 帧均报错。日志仅记录服务主机、状态码与代理模式，不输出请求正文或凭据。

本次限定 Google 的原生复测方法：

```sh
# 先退出已运行的随译，确认 60829/1420 无旧进程占用。
VITE_SUI_GOOGLE_LIVE=1 ./scripts/dev-local.sh
```

结果写入应用缓存 `google-live-results.json`；结束开发模式后执行 `pnpm tauri build --debug --bundles app`，再从输出 `.app` 启动。最终包的可执行文件 SHA-256、请求状态和 UI 结果记录在 `google-package-results.json`。本次没有改系统代理、授予辅助功能/屏幕录制权限，或配置有道凭据。免费网页协议可能再次变化，Windows/WPS/Linux 仍需实际设备验收。

## 本轮功能修复（2026-10-13）

上一轮的构建成功不能代表功能可用。本轮保留了全部既有改动，并补查了原生交互链。

修复的根因：

- 前端插件 Store 与原生 Store 各自缓存同一文件，监听重载和写入存在竞争；现改为所有窗口通过 IPC 读写同一个带互斥锁的原生 Store，每次修改完成后才返回，避免删除项复活或服务配置回退。
- React 本地状态更新后立即读取仍可能得到旧文本；现在同步更新引用，翻译提交使用独立请求版本，相同文本可再次提交，清空会同时清空待翻译内容并使旧请求失效。
- 服务配置保存使用延迟写入，弹窗关闭/列表刷新可能先发生；现在保存按钮等待落盘和原生配置重载，已打开的翻译/OCR 窗口收到事件后刷新服务实例配置。配置键切换也重新加载正确实例。
- 历史清空原先 `DROP TABLE`，之后缓存连接继续向已删除的表插入；改成删除记录、保留表，并使用隔离的真实 SQLite 数据库验证清空后仍能插入。
- 快捷键编辑原先在输入框获得焦点时立即注销、清空并保存；现在编辑是草稿，确认后才注册和保存；冲突会保留旧快捷键，Backspace 后确认可禁用。
- 自动语言检测无结果时，语言交换按钮引用了不存在的变量；已修正。Google 检测设定有超时、使用配置地址，网络失败时回退本地检测。
- 朗读现在主动恢复音频上下文，解码/播放错误会返回界面；修复旧音源结束回调可能误清理新音源的问题，支持词典结果的文本朗读/复制。
- 原生截图现在检查屏幕录制权限、截图退出状态和文件是否存在，取消不再读取旧截图；后台执行避免阻塞主窗口。划词缺少辅助功能权限或选区为空时显示明确原因。不会自动授予系统权限。
- 剪贴板监控释放锁后才创建窗口，避免与主线程停用操作互相等待。关闭监控时持续更新基线，避免重新打开后翻译旧内容。
- OCR 结果转翻译通过原生 IPC 调用，不再依赖应用自己的 HTTP 端口。HTTP 空文本返回 400，未知路径返回 404。
- 再次启动已运行的应用会重新显示主窗口；启动时单个快捷键注册失败不会阻止其余快捷键注册；错误提示集中渲染，避免工作台上重复显示多个同样的提示。

原生冒烟脚本位于 `tests/native-smoke.jsx`，通过开发开关在真实 Tauri WebView 中执行。它使用实际的 Store、SQLite、系统 OCR、剪贴板、快捷键管理器与网络，无 IPC 模拟器。系统 OCR 使用 `tests/fixtures/native-ocr.png` 中固定的测试文字，不使用伪造的翻译结果。

复测方法（先退出已运行的随译，避免单实例与端口冲突）：

```sh
# 先备份缓存中的 pot_screenshot_cut.png（若存在），测试后恢复。
cp tests/fixtures/native-ocr.png "$HOME/Library/Caches/com.lochungyin.sui.translate/pot_screenshot_cut.png"
VITE_SUI_NATIVE_SMOKE=1 ./scripts/dev-local.sh
```

结果写入应用缓存的 `native-smoke-results.json`；本轮结果副本为 `docs/native-smoke-results.json`。结束开发模式后再运行普通打包命令，生产构建不包含冒烟脚本。
