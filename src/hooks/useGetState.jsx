import { useState, useRef, useCallback } from 'react';

export const useGetState = (initState) => {
    const [state, setReactState] = useState(initState);
    const stateRef = useRef(state);
    const setState = useCallback((value) => {
        const next = typeof value === 'function' ? value(stateRef.current) : value;
        stateRef.current = next;
        setReactState(next);
    }, []);
    const getState = useCallback(() => stateRef.current, []);
    return [state, setState, getState];
};
