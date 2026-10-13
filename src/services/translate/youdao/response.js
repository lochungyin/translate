export function truncate(text) {
    return text.length <= 20 ? text : text.slice(0, 10) + text.length + text.slice(-10);
}

export function assertYoudaoSuccess(result) {
    if (!result || String(result.errorCode) !== '0') {
        const messages = {
            101: '缺少必填参数',
            108: '有道应用 ID 无效',
            110: '有道应用尚未开通翻译服务',
            111: '有道账号无效',
            202: '有道签名校验失败，请检查应用密钥',
            207: '有道请求重复，请重新翻译',
            401: '有道账号余额不足，请充值',
            411: '请求超出有道访问频率限制',
        };
        throw new Error(messages[result?.errorCode] ?? `有道翻译失败 (错误码 ${result?.errorCode ?? '未知'})`);
    }
}
