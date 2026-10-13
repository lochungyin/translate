import { fetch, ResponseType } from '../../../utils/service_http';
import { googleBase } from '../../translate/google/request';

export async function tts(text, lang, options = {}) {
    const config = options.config ?? {};
    const base = googleBase(config);
    const chunks = text.match(/[\s\S]{1,180}/gu) ?? [];
    const audio = [];
    for (const chunk of chunks) {
        const response = await fetch(`${base}/translate_tts`, {
            method: 'GET',
            query: { ie: 'UTF-8', client: 'tw-ob', tl: lang, q: chunk },
            responseType: ResponseType.Binary,
            timeout: 20,
        });
        if (!response.ok) throw new Error(`Google 语音请求失败 (${response.status})`);
        audio.push(...response.data);
    }
    if (!audio.length) throw new Error('请输入需要朗读的文本');
    return audio;
}

export { Language } from '../../translate/google/info';
export { Config } from './Config';
export const info = { name: 'google_tts', icon: 'logo/google.svg' };
