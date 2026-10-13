let audioContext;
let source;

const prepare = async () => {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') await audioContext.resume();
};

const playOrStop = async (data) => {
    if (source) {
        const playing = source;
        source = null;
        playing.stop();
        playing.disconnect();
        return;
    }
    await prepare();
    const buffer = await audioContext.decodeAudioData(new Uint8Array(data).buffer);
    const playing = audioContext.createBufferSource();
    playing.buffer = buffer;
    playing.connect(audioContext.destination);
    source = playing;
    playing.onended = () => {
        playing.disconnect();
        if (source === playing) source = null;
    };
    playing.start();
};
playOrStop.prepare = prepare;

export const useVoice = () => playOrStop;
