import { useAtom } from 'jotai';

import { useGetState } from './useGetState';

export const useSyncAtom = (atom) => {
    const [atomValue, setAtomValue] = useAtom(atom);
    const [localValue, setLocalValue, getLocalValue] = useGetState(atomValue);

    const syncAtom = () => setAtomValue(getLocalValue());
    const setValue = (value, sync = false) => {
        setLocalValue(value);
        if (sync) syncAtom();
    };

    return [localValue, setValue, syncAtom];
};
