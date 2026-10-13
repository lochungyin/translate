#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
SUI_TOOLCHAIN="$HOME/.cache/codex-runtimes/sui-rust"
if ! command -v cargo >/dev/null 2>&1 && [ -x "$SUI_TOOLCHAIN/cargo/bin/cargo" ]; then
    export CARGO_HOME="$SUI_TOOLCHAIN/cargo"
    export RUSTUP_HOME="$SUI_TOOLCHAIN/rustup"
    export PATH="$CARGO_HOME/bin:$PATH"
fi
exec pnpm tauri dev "$@"
