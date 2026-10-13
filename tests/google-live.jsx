// Executes in the actual Tauri WebView; never substitutes a Google response.
import { invoke } from '@tauri-apps/api';
import { writeTextFile, BaseDirectory } from '@tauri-apps/api/fs';
import { info } from 'tauri-plugin-log-api';
import { translate } from '../src/services/translate/google';
import { tts } from '../src/services/tts/google';
import { store } from '../src/utils/store';
import { google_detect } from '../src/utils/lang_detect';
import { googleRequest } from '../src/services/translate/google/request';

export async function runGoogleLive() {
    const results = { date: new Date().toISOString(), tests: [] };
    const test = async (name, action) => {
        try { results.tests.push({ name, status: 'passed', detail: await action() }); }
        catch (error) { results.tests.push({ name, status: /429|网络|连接|验证/.test(String(error)) ? 'blocked' : 'failed', detail: String(error) }); }
        await writeTextFile('google-live-results.json', JSON.stringify(results, null, 2), { dir: BaseDirectory.AppCache });
        await info(`GOOGLE_LIVE ${JSON.stringify(results.tests.at(-1))}`);
    };
    await new Promise((resolve) => setTimeout(resolve, 1500));
    results.proxyEnabled = (await store.get('proxy_enable')) ?? false;
    const config = await store.get('google');
    const request = googleRequest('Hello, world.', 'auto', 'zh-CN', config);
    results.endpoint = { method: request.method, url: request.url, protocol: request.mode };
    try { results.transport = await invoke('service_http_status'); } catch { results.transport = 'Original Tauri default HTTP client'; }
    await test('Google translation via real native transport', async () => {
        const result = await translate('Hello, world.', 'auto', 'zh-CN', { config });
        if (typeof result !== 'string' || !/[\u3400-\u9fff]/.test(result)) throw new Error('No Chinese translated text');
        return result;
    });
    await test('Google multiline Chinese to English via native transport', async () => {
        const result = await translate('你好。\n今天是晴天。', 'auto', 'en', { config });
        if (typeof result !== 'string' || !/[a-z]/i.test(result) || !result.includes('\n')) throw new Error('Missing translated lines');
        return result;
    });
    await test('Google language detection via shared web request', async () => {
        const language = await google_detect('This sentence is written in English.');
        if (language !== 'en') throw new Error(`Unexpected detected language: ${language}`);
        return language;
    });
    await test('Google TTS real network and WebKit audio decoding', async () => {
        const data = await tts('Hello Sui Translate.', 'en');
        const context = new OfflineAudioContext(1, 24000, 24000);
        const audio = await context.decodeAudioData(new Uint8Array(data).buffer);
        if (audio.duration < 0.5) throw new Error('No decodable audio');
        return { bytes: data.length, seconds: audio.duration, sampleRate: audio.sampleRate };
    });
}
