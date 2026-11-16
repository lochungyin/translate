import { fetch, Body, ResponseType } from '../../../utils/service_http';
import { guestSessionQuery, translationForm } from './request';
import { assertYoudaoHttp, parseGuestSession, parseYoudaoStream } from './response';

const webApi = 'https://dict-trans.youdao.com';
let guestToken;
let pendingSession;

async function request(path, options) {
    let response;
    try {
        response = await fetch(webApi + path, { method: 'POST', ...options });
    } catch (error) {
        throw new Error(`有道网页翻译连接失败：${error instanceof Error ? error.message : error}`);
    }
    assertYoudaoHttp(response);
    return response.data;
}

async function getGuestSession() {
    if (!pendingSession) {
        // The website renews its anonymous session using the previous guest token.
        pendingSession = request('/translate/key', { query: guestSessionQuery(guestToken) })
            .then(parseGuestSession)
            .then((session) => {
                guestToken = session.token;
                return session;
            })
            .finally(() => {
                pendingSession = undefined;
            });
    }
    return pendingSession;
}

export async function translate(text, from, to) {
    text = text.trim();
    if (!text) return '';
    if (!from || !to) throw new Error('有道网页翻译暂不支持该语言方向，请选择其他语言或翻译服务');
    if (text.length > 5000) throw new Error('有道网页翻译单次最多支持 5000 个字符，请缩短原文');

    const session = await getGuestSession();
    const body = await request('/webtranslate/sse', {
        body: Body.form(translationForm(text, from, to, session)),
        multipart: true,
        timeout: 30,
        responseType: ResponseType.Text,
    });
    return parseYoudaoStream(body);
}

export * from './Config';
export * from './info';
