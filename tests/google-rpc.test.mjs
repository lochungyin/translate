import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGoogleRpcResponse } from '../src/services/translate/google/response.js';
import { googleBase, googleProtocol, googleRequest, assertGoogleHttp } from '../src/services/translate/google/request.js';

// Captured from real public-text HTTP requests on 2026-10-13. These regression
// tests cover parsing only; tests/google-live.jsx proves native online behavior.
const samples = JSON.parse(readFileSync(new URL('./fixtures/google-web-rpc.json', import.meta.url)));
for (const sample of samples) {
    test(`Google actual RPC frame: ${sample.case}`, () => {
        assert.deepEqual(parseGoogleRpcResponse(sample.body), {
            translation: sample.expected, detectedLanguage: sample.detectedLanguage,
        });
    });
}

test('RPC request safely encodes Unicode, newlines, quotes and form characters', () => {
    const text = '你好\n"test" & + = ?';
    const request = googleRequest(text, 'auto', 'en', { custom_url: 'translate.google.com/' });
    assert.equal(request.method, 'POST');
    assert.equal(request.url, 'https://translate.google.com/_/TranslateWebserverUi/data/batchexecute');
    assert.deepEqual(JSON.parse(JSON.parse(request.form['f.req'])[0][0][1])[0], [text, 'auto', 'en', true]);
    assert.deepEqual(request.query, { rpcids: 'MkEWBc', rt: 'c' });
});

test('legacy custom endpoints remain an explicit choice and use the same base', () => {
    const request = googleRequest('hello', 'auto', 'zh-CN', { custom_url: 'https://example.com/proxy/', api_mode: 'legacy' });
    assert.equal(request.method, 'GET');
    assert.match(request.url, /^https:\/\/example.com\/proxy\/translate_a\/single/);
    assert.equal(googleBase({ custom_url: 'https://example.com/proxy/' }), 'https://example.com/proxy');
    assert.throws(() => googleBase({ custom_url: 'https://secret:password@example.com' }), /服务地址/);
    assert.throws(() => googleBase({ custom_url: 'ftp://example.com' }), /HTTP/);
    assert.equal(googleProtocol({ custom_url: 'translate.googleapis.com/' }), 'legacy');
    assert.equal(googleProtocol({ custom_url: 'https://translate.googleapis.com', api_mode: 'web_rpc' }), 'web_rpc');
});

test('rate limits, verification and malformed RPC responses never count as translations', () => {
    assert.throws(() => assertGoogleHttp({ ok: false, status: 429, data: '' }), /429/);
    assert.throws(() => assertGoogleHttp({ ok: false, status: 302, data: '' }), /验证/);
    assert.throws(() => assertGoogleHttp({ ok: true, status: 200, data: '<html>captcha</html>' }), /网页/);
    assert.throws(() => parseGoogleRpcResponse('<html>verification</html>'), /未返回译文/);
    assert.throws(() => parseGoogleRpcResponse('[["wrb.fr","MkEWBc",null,null,null,[429]]]'), /未返回译文/);
    assert.throws(() => parseGoogleRpcResponse('[["wrb.fr","OtherRpc","[]"]]'), /未返回译文/);
    assert.throws(() => parseGoogleRpcResponse('[["wrb.fr","MkEWBc","[]"]]'), /格式/);
});
