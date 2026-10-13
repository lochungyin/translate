import { invoke } from '@tauri-apps/api';
export { Body, ResponseType } from '@tauri-apps/api/http';

// The built-in providers share a native client that tracks saved app proxy settings.
export async function fetch(url, options = {}) {
    if (options.body && options.body.type !== 'Form') throw new Error('服务请求仅支持文本表单');
    return invoke('service_http_request', {
        request: {
            url,
            method: options.method ?? 'GET',
            query: Object.entries(options.query ?? {}).map(([key, value]) => [key, String(value)]),
            form: options.body?.payload ?? null,
            responseType: options.responseType ?? 1,
            timeout: options.timeout ?? 20,
        },
    });
}
