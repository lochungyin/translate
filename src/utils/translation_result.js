export function translationText(result) {
    if (typeof result === 'string') return result;
    const explanations = (result?.explanations ?? []).map((entry) =>
        `${entry.trait || ''} ${(entry.explains ?? []).join('；')}`.trim()
    );
    return [...explanations, ...(result?.associations ?? [])].join('\n');
}
