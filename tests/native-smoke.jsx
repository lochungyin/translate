// Runs inside a real Tauri WebView. All OS, network and database calls are real.
import { invoke } from '@tauri-apps/api';
import { writeTextFile, BaseDirectory } from '@tauri-apps/api/fs';
import { readText, writeText } from '@tauri-apps/api/clipboard';
import { WebviewWindow } from '@tauri-apps/api/window';
import { isRegistered } from '@tauri-apps/api/globalShortcut';
import Database from 'tauri-plugin-sql-api';
import { translate } from '../src/services/translate/google';
import { translate as youdaoTranslate } from '../src/services/translate/youdao';
import { tts } from '../src/services/tts/google';
import { clearHistoryDatabase } from '../src/utils/history';
import { store } from '../src/utils/store';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { useConfig } from '../src/hooks/useConfig';
import { useGetState } from '../src/hooks/useGetState';
import { info } from 'tauri-plugin-log-api';

async function verifyHooks() {
    const first = '__native_smoke_first';
    const second = '__native_smoke_second';
    const previous = new Map(await Promise.all([first, second].map(async (key) => [key, await store.get(key)])));
    const host = document.createElement('div');
    const root = createRoot(host);
    let probe;
    function Probe() {
        const [key, setKey] = React.useState(first);
        const [value, setValue] = useConfig(key, { marker: 'default' }, { sync: false });
        const [local, setLocal, getLocal] = useGetState('first');
        probe = { key, setKey, value, setValue, setLocal, getLocal };
        return null;
    }
    const until = async (predicate) => {
        const deadline = Date.now() + 5000;
        while (!predicate()) {
            if (Date.now() > deadline) throw new Error('Hook update timed out');
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
    };
    try {
        root.render(<Probe />);
        await until(() => probe?.value !== null && probe?.value !== undefined);
        probe.setLocal('new');
        if (probe.getLocal() !== 'new') throw new Error('Same-tick state read returned stale text');
        probe.setLocal((text) => text + ' text');
        if (probe.getLocal() !== 'new text') throw new Error('Functional state update returned stale text');
        await probe.setValue({ marker: 'saved' }, true);
        if ((await store.get(first))?.marker !== 'saved') throw new Error('Forced save completed before persistence');
        probe.setKey(second);
        await until(() => probe.key === second && probe.value?.marker === 'default');
        await probe.setValue({ marker: 'second' }, true);
        if ((await store.get(first))?.marker !== 'saved' || (await store.get(second))?.marker !== 'second') {
            throw new Error('Changed config key wrote to stale service instance');
        }
        return 'Immediate state reads, awaited config saves and service-key switching passed with native Store';
    } finally {
        root.unmount();
        for (const [key, value] of previous) {
            if (value === null) await store.delete(key); else await store.set(key, value);
        }
        await store.save();
        await invoke('reload_store');
        for (const [key, value] of previous) {
            if (value === null && await store.has(key)) throw new Error('Deleted test key was resurrected by a stale Store cache');
        }
    }
}

export async function runNativeSmoke() {
    const results = [];
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const test = async (name, action, blocked = false) => {
        try { results.push({ name, status: 'passed', detail: await action() }); }
        catch (error) { results.push({ name, status: blocked ? 'blocked' : 'failed', detail: String(error) }); }
    };
    // Wait for normal application initialization, without a second Store instance.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await test('state and configuration lifecycle with native Store', verifyHooks);
    await test('system OCR via native IPC', async () => {
        const text = await invoke('system_ocr', { lang: 'en-US' });
        check(text.includes('Hello Sui Translate 2026') && text.includes('Native OCR test'), text);
        return text.trim();
    });
    await test('Google live translation', async () => {
        const result = await translate('Hello, world.', 'auto', 'zh-CN', { config: await store.get('google') });
        check(result && (typeof result !== 'string' || result.trim()), 'Empty result');
        return result;
    }, true);
    await test('Google TTS real network and audio decoding', async () => {
        const data = await tts('Hello Sui Translate.', 'en');
        const context = new OfflineAudioContext(1, 24000, 24000);
        const audio = await context.decodeAudioData(new Uint8Array(data).buffer);
        check(audio.duration > 0.5, 'No decodable audio');
        return { bytes: data.length, seconds: audio.duration, sampleRate: audio.sampleRate };
    });
    await test('Youdao live translation', async () => {
        const config = await store.get('youdao');
        check(config?.appkey && config?.key, 'Requires Youdao app ID and secret');
        const result = await youdaoTranslate('Hello, world.', 'auto', 'zh-CHS', { config });
        check(result, 'Empty result');
        return 'Received a live translation';
    }, true);
    await test('native SQLite clear then insert', async () => {
        const db = await Database.load('sqlite:native-smoke.db');
        try {
            await db.execute('CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, text TEXT)');
            await db.execute('DELETE FROM history');
            await db.execute('INSERT INTO history (text) VALUES ($1)', ['before clear']);
            await clearHistoryDatabase(db);
            await db.execute('INSERT INTO history (text) VALUES ($1)', ['after clear']);
            const rows = await db.select('SELECT text FROM history');
            check(rows.length === 1 && rows[0].text === 'after clear', JSON.stringify(rows));
            await db.execute('DELETE FROM history');
            return 'Table survives clear and accepts new records in isolated test database';
        } finally { await db.close(); }
    });
    await test('native clipboard write/read/restore', async () => {
        const previous = await readText();
        // Do not replace image/file clipboard contents, or enable monitoring.
        check(previous !== null, 'Skipped: clipboard contains non-text data');
        check(!(await store.get('clipboard_monitor')), 'Skipped: clipboard monitor is enabled');
        try {
            await writeText('Sui native clipboard check');
            check(await readText() === 'Sui native clipboard check', 'Clipboard mismatch');
            return 'Readback matches; previous text restored';
        } finally { await writeText(previous); }
    });
    await test('clipboard monitoring opens real translation window', async () => {
        const previous = await readText();
        check(previous !== null, 'Skipped: clipboard contains non-text data');
        check(!(await store.get('clipboard_monitor')), 'Skipped: monitor already enabled');
        const text = 'Sui native clipboard monitor check';
        try {
            await invoke('set_clipboard_monitor', { enabled: true });
            await writeText(text);
            const deadline = Date.now() + 5000;
            while (await invoke('get_text') !== text) {
                check(Date.now() < deadline, 'Clipboard monitoring did not deliver new text');
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            check(WebviewWindow.getByLabel('translate'), 'No native translation window');
            return 'Clipboard change reached native translation state and opened the real window';
        } finally {
            await invoke('set_clipboard_monitor', { enabled: false });
            await writeText(previous);
            await WebviewWindow.getByLabel('translate')?.close();
        }
    });
    await test('shortcut conflict preserves existing bindings', async () => {
        const input = await store.get('hotkey_input_translate');
        const selection = await store.get('hotkey_selection_translate');
        check(input && selection && input !== selection, 'Requires distinct configured input/selection shortcuts');
        check(await isRegistered(input) && await isRegistered(selection), 'Expected native shortcuts registered');
        let rejected = false;
        try { await invoke('register_shortcut_by_frontend', { name: 'hotkey_selection_translate', shortcut: input }); }
        catch { rejected = true; }
        check(rejected, 'Conflicting shortcut must be rejected');
        check(await isRegistered(input) && await isRegistered(selection), 'Existing shortcuts lost after conflict');
        return 'Conflict rejected; both old shortcuts remain registered';
    });
    await writeTextFile('native-smoke-results.json', JSON.stringify(results, null, 2), { dir: BaseDirectory.AppCache });
    await info(`NATIVE_SMOKE ${JSON.stringify(results)}`);
}
