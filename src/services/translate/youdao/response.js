const rateLimit = '有道网页翻译的游客请求已达限额，请稍后重试';
const loginRequired = '有道网页翻译要求登录，请在有道官网查看服务状态';
const verificationRequired = '有道网页翻译要求验证或暂时限制访问，请在有道官网查看服务状态';
const invalidStream = '有道网页翻译返回了无法识别的译文，请稍后重试';

export function assertYoudaoHttp({ status, ok, redirectHost }) {
    if (status === 429) throw new Error(rateLimit);
    if (status === 401 || redirectHost === 'c.youdao.com') throw new Error(loginRequired);
    if (status === 403 || (status >= 300 && status < 400)) throw new Error(verificationRequired);
    if (!ok) throw new Error(`有道网页翻译请求失败（HTTP ${status}），请检查网络或应用代理后重试`);
}

function rejectHtml(body) {
    if (typeof body !== 'string' || !body.trimStart().startsWith('<')) return;
    if (/<title>[^<]*(?:登录|log.?in|sign.?in)/i.test(body)) throw new Error(loginRequired);
    throw new Error(verificationRequired);
}

function throwYoudaoError(payload, fallback) {
    const data = payload?.data;
    const code = String(payload?.code ?? data?.code ?? '');
    const message = [payload?.msg, payload?.message, data?.msg, data?.message].join(' ');
    if (code === '429' || payload?.isDog || data?.isDog ||
        /频繁|限流|限额|上限|次数.*(?:用完|耗尽)|rate.?limit|too many requests|quota/i.test(message)) {
        throw new Error(rateLimit);
    }
    if (code === '401' || /登录|log.?in|sign.?in|unauthenticated/i.test(message)) {
        throw new Error(loginRequired);
    }
    if (code === '403' || code === '50' || payload?.isCat || data?.isCat ||
        /验证|验证码|captcha|verification/i.test(message)) {
        throw new Error(verificationRequired);
    }
    if (code === '605' || /不支持的语言|unsupported language/i.test(message)) {
        throw new Error('有道网页翻译暂不支持该语言方向，请选择其他语言或翻译服务');
    }
    const codeLabel = /^-?\d+$/.test(code) && code !== '0' ? `（错误码 ${code}）` : '';
    throw new Error(fallback + codeLabel);
}

export function parseGuestSession(payload) {
    rejectHtml(payload);
    const { secretKey, token } = payload?.data ?? {};
    if (String(payload?.code) !== '0' || typeof secretKey !== 'string' || !secretKey ||
        typeof token !== 'string' || !token) {
        throwYoudaoError(payload, '有道网页翻译未能建立游客会话，请稍后重试');
    }
    return { secretKey, token };
}

export function parseYoudaoStream(body) {
    if (typeof body !== 'string') throwYoudaoError(body, invalidStream);
    rejectHtml(body);
    const source = body.trimStart();
    if (source.startsWith('{')) throwYoudaoError(parseJson(source), invalidStream);

    const chunks = [];
    let finished = false;
    for (const block of source.replace(/\r\n?/g, '\n').split('\n\n')) {
        let event = 'message';
        const data = [];
        for (const line of block.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        }
        if (data.length === 0) continue;
        if (event === 'error') throwYoudaoError(parseJson(data.join('\n')), '有道网页翻译失败，请稍后重试');
        if (event === 'message') {
            const result = parseJson(data.join('\n'));
            if (typeof result?.transIncre !== 'string') throwYoudaoError(result, invalidStream);
            chunks.push(result.transIncre);
        }
        if (event === 'end') {
            finished = true;
            break;
        }
    }
    const translation = chunks.join('').trim();
    if (!finished || !translation) throw new Error(invalidStream);
    return translation;
}

function parseJson(value) {
    try {
        return JSON.parse(value);
    } catch {
        throw new Error(invalidStream);
    }
}
