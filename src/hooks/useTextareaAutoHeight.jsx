import { useLayoutEffect } from 'react';

export function useTextareaAutoHeight(ref, value, fontSize) {
    useLayoutEffect(() => {
        const textarea = ref.current;
        if (!textarea) return;

        const resize = () => {
            textarea.style.height = '0px';
            if (value) textarea.style.height = `${textarea.scrollHeight}px`;
        };
        let width = textarea.getBoundingClientRect().width;
        const observer = new ResizeObserver(([entry]) => {
            // Height changes also notify the observer; only reflow for width changes.
            if (entry.contentRect.width !== width) {
                width = entry.contentRect.width;
                resize();
            }
        });
        resize();
        observer.observe(textarea);
        return () => observer.disconnect();
    }, [ref, value, fontSize]);
}
