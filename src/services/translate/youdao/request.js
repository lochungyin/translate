import CryptoJS from 'crypto-js';

// Public bootstrap value shipped by fanyi.youdao.com for its anonymous text translator.
const guestBootstrapKey = 'kSy5gtKA4yRUxAVPJPrdYKZ0jBKyd3t1';
const translationKeyId = 'translate-webfanyi-webmain';
const webDefaults = {
    product: 'webfanyi',
    keyfrom: 'webfanyi.webmain',
    client: 'webmain',
    mid: '1',
    vendor: 'web',
    screen: '1',
    model: '1',
    imei: '1',
    network: 'wifi',
    yduuid: 'abcdefg',
};

function sign(fields, secretKey, now) {
    const params = { ...webDefaults, ...fields, mysticTime: String(now) };
    const keys = Object.keys(params).sort();
    const input = keys.map((key) => `${key}=${params[key]}`).join('&');
    return {
        ...params,
        sign: CryptoJS.MD5(`${input}&key=${secretKey}`).toString(),
        pointParam: [...keys, 'key'].join(','),
    };
}

export function guestSessionQuery(token, now = Date.now()) {
    return sign({
        appVersion: '12.0.0',
        keyid: 'translate-webmain-key-getter',
        targetKeyid: translationKeyId,
        abtest: '0',
        ...(token ? { token } : {}),
    }, guestBootstrapKey, now);
}

export function translationForm(text, from, to, { token, secretKey }, now = Date.now()) {
    return sign({
        appVersion: '1',
        keyid: translationKeyId,
        keyId: translationKeyId,
        signSecretKey: secretKey,
        token,
        source: 'webmain',
        modelName: 'llmLite',
        useTerm: 'false',
        i: encodeURIComponent(text),
        from,
        to,
    }, secretKey, now);
}
