#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

SUI_WINDOWS_TOOLS="${SUI_WINDOWS_TOOLCHAIN:-$HOME/.cache/codex-runtimes/sui-windows}"
SUI_RUST_TOOLS="$HOME/.cache/codex-runtimes/sui-rust"
if ! command -v cargo >/dev/null 2>&1 && [ -x "$SUI_RUST_TOOLS/cargo/bin/cargo" ]; then
    export CARGO_HOME="$SUI_RUST_TOOLS/cargo"
    export RUSTUP_HOME="$SUI_RUST_TOOLS/rustup"
    export PATH="$CARGO_HOME/bin:$PATH"
fi
export PATH="$SUI_WINDOWS_TOOLS/bin:/opt/homebrew/opt/llvm/bin:/opt/homebrew/opt/lld/bin:$PATH"
for tool in cargo rustup cargo-xwin clang-cl llvm-rc lld-link makensis cmake ninja pnpm; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "Missing Windows cross-build dependency: $tool" >&2
        exit 1
    fi
done
if [ "${SUI_WINDOWS_SDK_ACCEPTED:-}" != 1 ]; then
    echo "cargo-xwin requires acceptance of the Microsoft SDK license:" >&2
    echo "https://go.microsoft.com/fwlink/?LinkId=2086102" >&2
    echo "After reviewing and accepting it, set SUI_WINDOWS_SDK_ACCEPTED=1." >&2
    exit 1
fi

export XWIN_CACHE_DIR="$SUI_WINDOWS_TOOLS/sdk"
export XWIN_ARCH=x86_64
# Tauri 1 selects the VC runtime itself; forcing crt-static conflicts with its
# static_vcruntime UCRT linker policy during an MSVC cross-build.
exec pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis --config src-tauri/tauri.windows.conf.json "$@"
