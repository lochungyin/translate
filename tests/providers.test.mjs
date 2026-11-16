import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGoogleResponse } from '../src/services/translate/google/response.js';
import { guestSessionQuery, translationForm } from '../src/services/translate/youdao/request.js';
import { assertYoudaoHttp, parseGuestSession, parseYoudaoStream } from '../src/services/translate/youdao/response.js';

test('Google joins translated segments and skips pronunciation-only rows', () => {
    assert.equal(
        parseGoogleResponse([
            [
                ['你好', 'Hello'],
                ['，世界。', 'world'],
                [null, null, 'nǐ hǎo'],
            ],
        ]),
        '你好，世界。'
    );
});
test('Google dictionary responses may omit the pronunciation row', () => {
    const result = parseGoogleResponse([[['世界', 'world']], [['noun', ['世界'], [['世界']]]]]);
    assert.deepEqual(result.pronunciations, []);
    assert.deepEqual(result.explanations, [{ trait: 'noun', explains: ['世界'] }]);
});
test('Google malformed responses produce an actionable error', () => {
    assert.throws(() => parseGoogleResponse({ error: 'rate limited' }), /Google/);
});
test('Youdao starts an anonymous session and signs the translation using its returned key', () => {
    const first = guestSessionQuery(undefined, 1700000000000);
    assert.equal(first.keyid, 'translate-webmain-key-getter');
    assert.equal(first.targetKeyid, 'translate-webfanyi-webmain');
    assert.equal(first.sign, 'cf2a14e00c88ed26d7504d78583315d9');
    assert.equal(first.token, undefined);
    const session = parseGuestSession({ code: 0, data: { token: 'guest', secretKey: 'session-key' } });
    assert.equal(guestSessionQuery(session.token, 1700000000000).token, 'guest');
    const form = translationForm('a+b & 世界\n!', 'auto', 'zh-CHS', session, 1700000000000);
    assert.equal(form.i, 'a%2Bb%20%26%20%E4%B8%96%E7%95%8C%0A!');
    assert.equal(form.token, 'guest');
    assert.equal(form.from, 'auto');
    assert.equal(form.to, 'zh-CHS');
    assert.ok(form.pointParam.split(',').includes('i'));
});

test('Youdao concatenates SSE translation chunks and rejects incomplete streams', () => {
    const chunks = [
        'event:begin\r\ndata:{"type":"en2zh-CHS"}',
        'event:message\r\ndata:{"transIncre":"你好"}',
        'event:message\r\ndata:{"transIncre":"，世界！"}',
    ].join('\r\n\r\n');
    assert.equal(parseYoudaoStream(chunks + '\r\n\r\nevent:end\r\ndata:{}\r\n\r\n'), '你好，世界！');
    assert.throws(() => parseYoudaoStream(chunks), /无法识别/);
});

test('Youdao distinguishes rate limiting, login, verification and unsupported languages', () => {
    assert.throws(() => assertYoudaoHttp({ status: 429, ok: false }), /限额/);
    assert.throws(() => assertYoudaoHttp({ status: 302, ok: false, redirectHost: 'c.youdao.com' }), /登录/);
    assert.throws(() => assertYoudaoHttp({ status: 503, ok: false }), /HTTP 503/);
    assert.throws(() => parseGuestSession({ code: 0, data: {} }), /未能建立游客会话/);
    assert.throws(() => parseGuestSession({ code: 50 }), /验证/);
    assert.throws(() => parseYoudaoStream('{"code":605,"msg":"不支持的语言方向"}'), /语言方向/);
    assert.throws(() => parseYoudaoStream('event:error\ndata:{"msg":"游客次数已用完"}\n\n'), /限额/);
    assert.throws(() => parseYoudaoStream('event:error\ndata:{"msg":"请登录后继续"}\n\n'), /登录/);
    assert.throws(() => parseYoudaoStream('<html><title>登录 - 有道</title></html>'), /登录/);
});

import { translationText } from '../src/utils/translation_result.js';
test('dictionary results are stored as readable text in history', () => {
    assert.equal(
        translationText({ explanations: [{ trait: 'n.', explains: ['世界', '领域'] }], associations: ['复数 worlds'] }),
        'n. 世界；领域\n复数 worlds'
    );
    assert.equal(translationText('你好'), '你好');
});
