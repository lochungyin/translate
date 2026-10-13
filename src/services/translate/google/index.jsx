import { fetch, Body, ResponseType } from '../../../utils/service_http';
import { parseGoogleResponse, parseGoogleRpcResponse } from './response';
import { googleRequest, assertGoogleHttp } from './request';

export async function requestGoogleTranslation(text, from, to, options = {}) {
    const config = options.config ?? {};
    const { mode, url, form, ...request } = googleRequest(text, from, to, config);
    const response = await fetch(url, {
        ...request,
        body: form ? Body.form(form) : undefined,
        timeout: 20,
        responseType: ResponseType.Text,
    });
    assertGoogleHttp(response);
    if (mode === 'web_rpc') return parseGoogleRpcResponse(response.data);
    let data;
    try {
        data = JSON.parse(response.data);
    } catch {
        throw new Error('Google 连接受限或要求验证，请稍后重试，或在常规设置中配置可用代理');
    }
    return { translation: parseGoogleResponse(data), detectedLanguage: data[2] };
}

export async function translate(text, from, to, options = {}) {
    if (!text.trim()) return '';
    return (await requestGoogleTranslation(text, from, to, options)).translation;
}

export * from './Config';
export * from './info';
