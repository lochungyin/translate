export function googleBase(config = {}) {
    let base = config.custom_url?.trim() || 'https://translate.google.com';
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(base) && !/^https?:\/\//i.test(base)) {
        throw new Error('Google 服务地址必须使用 HTTP/HTTPS');
    }
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('Google 服务地址必须是 HTTP/HTTPS 基础地址，不能包含凭据、查询或片段');
    }
    return url.toString().replace(/\/$/, '');
}

export function googleProtocol(config = {}) {
    return config.api_mode ?? (/^(?:https?:\/\/)?translate\.googleapis\.com(?=[:/]|$)/i.test(config.custom_url?.trim() ?? '') ? 'legacy' : 'web_rpc');
}

export function googleRequest(text, from, to, config = {}) {
    const base = googleBase(config);
    const mode = googleProtocol(config);
    if (mode === 'legacy') {
        return { mode, url: `${base}/translate_a/single?dt=t&dt=bd&dt=rm&dt=ex`,
            method: 'GET', query: { client: 'gtx', sl: from, tl: to, hl: to, q: text } };
    }
    if (mode !== 'web_rpc') throw new Error('Google 请求协议无效，请在服务设置中重新选择');
    const args = JSON.stringify([[text, from, to, true], [null]]);
    return { mode, url: `${base}/_/TranslateWebserverUi/data/batchexecute`, method: 'POST',
        query: { rpcids: 'MkEWBc', rt: 'c' },
        form: { 'f.req': JSON.stringify([[['MkEWBc', args, null, 'generic']]]) } };
}

export function assertGoogleHttp(response) {
    if (response.status === 429) throw new Error('Google 当前接口限流 (HTTP 429)，请稍后重试；可检查应用代理。应用不会自动重试或切换接口');
    if (response.status >= 300 && response.status < 400) {
        throw new Error('Google 返回重定向或要求网页验证，已停止请求。请在浏览器检查 Google 翻译');
    }
    if (!response.ok) throw new Error(`Google 请求失败 (HTTP ${response.status})，请检查服务地址、应用代理或网络`);
    if (typeof response.data !== 'string' || /^\s*</.test(response.data)) {
        throw new Error('Google 返回了网页而非译文，可能要求验证；请在浏览器检查 Google 翻译');
    }
}
