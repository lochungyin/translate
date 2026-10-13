import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGoogleResponse } from '../src/services/translate/google/response.js';
import { assertYoudaoSuccess, truncate } from '../src/services/translate/youdao/response.js';

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
test('Youdao accepts string or numeric success codes and rejects API errors', () => {
    assert.doesNotThrow(() => assertYoudaoSuccess({ errorCode: '0' }));
    assert.doesNotThrow(() => assertYoudaoSuccess({ errorCode: 0 }));
    assert.throws(() => assertYoudaoSuccess({ errorCode: '202' }), /签名/);
    assert.throws(() => assertYoudaoSuccess({ errorCode: '401' }), /余额/);
    assert.throws(() => assertYoudaoSuccess(null), /未知/);
});
test('Youdao v3 signing truncates only texts longer than 20 characters', () => {
    assert.equal(truncate('01234567890123456789'), '01234567890123456789');
    assert.equal(truncate('0123456789ABCDEFGHIJK'), '012345678921BCDEFGHIJK');
});

import { translationText } from '../src/utils/translation_result.js';
test('dictionary results are stored as readable text in history', () => {
    assert.equal(
        translationText({ explanations: [{ trait: 'n.', explains: ['世界', '领域'] }], associations: ['复数 worlds'] }),
        'n. 世界；领域\n复数 worlds'
    );
    assert.equal(translationText('你好'), '你好');
});
