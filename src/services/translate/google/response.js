export function parseGoogleResponse(result) {
    if (!Array.isArray(result) || !Array.isArray(result[0])) {
        throw new Error('Google 返回了无法识别的结果，请检查服务地址或稍后重试');
    }
    if (Array.isArray(result[1]) && result[1].length) {
        const target = { pronunciations: [], explanations: [], associations: [], sentence: [] };
        const pronunciation = result[0].find((item) => item?.[3])?.[3];
        if (pronunciation) target.pronunciations.push({ symbol: pronunciation, voice: '' });
        for (const entry of result[1]) {
            target.explanations.push({ trait: entry[0], explains: (entry[2] ?? []).map((item) => item[0]) });
        }
        for (const example of result[13]?.[0] ?? []) target.sentence.push({ source: example[0] });
        return target;
    }
    return result[0]
        .map((item) => item?.[0] ?? '')
        .join('')
        .trim();
}

export function parseGoogleRpcResponse(body) {
    // batchexecute frames have an XSSI prefix and byte-length lines. Each JSON
    // frame is on its own line; ignore unrelated RPC/telemetry frames.
    const source = body.replace(/^\s*\)\]\}'\s*/, '');
    let record;
    const frames = [source.trim(), ...source.split(/\r?\n/).map((line) => line.trim())];
    for (const frame of frames) {
        if (!frame.startsWith('[')) continue;
        try {
            record = JSON.parse(frame).find((item) => item?.[0] === 'wrb.fr' && item?.[1] === 'MkEWBc');
        } catch { continue; }
        if (record) break;
    }
    if (!record || typeof record[2] !== 'string') {
        throw new Error('Google 网页接口未返回译文，请稍后重试或检查服务地址');
    }
    let result;
    try { result = JSON.parse(record[2]); }
    catch { throw new Error('Google 网页接口响应格式无效'); }
    const paragraphs = result?.[1]?.[0];
    if (!Array.isArray(paragraphs)) throw new Error('Google 网页接口响应格式已变化，未找到译文');
    const translation = paragraphs.map((paragraph) => {
        if (!Array.isArray(paragraph?.[5])) throw new Error('Google 网页接口响应格式已变化，未找到译文');
        return paragraph[5].map((segment) => typeof segment?.[0] === 'string' ? segment[0] : '').join('');
    }).join('\n').trim();
    if (!translation) throw new Error('Google 返回了空译文');
    return { translation, detectedLanguage: result[2] || result[0]?.[2] || result[1]?.[3] };
}
