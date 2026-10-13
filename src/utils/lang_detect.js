import { invoke } from '@tauri-apps/api';
import { store } from './store';
import { requestGoogleTranslation } from '../services/translate/google';

export async function google_detect(text) {
    const lang_map = {
        'zh-CN': 'zh_cn',
        'zh-TW': 'zh_tw',
        ja: 'ja',
        en: 'en',
        ko: 'ko',
        fr: 'fr',
        es: 'es',
        ru: 'ru',
        de: 'de',
        it: 'it',
        tr: 'tr',
        pt: 'pt_pt',
        vi: 'vi',
        id: 'id',
        th: 'th',
        ms: 'ms',
        ar: 'ar',
        hi: 'hi',
        mn: 'mn_cy',
        km: 'km',
        fa: 'fa',
        no: 'nb_no',
        uk: 'uk'
    };
    let config = (await store.get('google')) ?? {};
    for (const key of (await store.get('translate_service_list')) ?? ['google']) {
        if (key.split('@')[0] !== 'google') continue;
        const candidate = (await store.get(key)) ?? {};
        if (candidate.enable !== false) { config = candidate; break; }
    }
    const result = await requestGoogleTranslation(text, 'auto', 'zh-CN', { config });
    if (result.detectedLanguage in lang_map) return lang_map[result.detectedLanguage];
    throw new Error('Google 语言检测失败');
}

export default async function detect(text) {
    if (!text.trim()) return '';
    const engine = (await store.get('translate_detect_engine')) ?? 'local';
    if (engine === 'google') {
        try { return await google_detect(text); }
        catch { /* Keep translation available when online detection is unreachable. */ }
    }
    return invoke('lang_detect', { text });
}
