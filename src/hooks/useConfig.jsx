import { useCallback, useEffect, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { useGetState } from './useGetState';
import { store } from '../utils/store';
import { invoke } from '@tauri-apps/api';

export const useConfig = (key, defaultValue, options = {}) => {
    const [property, setPropertyState, getProperty] = useGetState(null);
    const { sync = true } = options;
    const timer = useRef();
    const defaults = useRef(defaultValue);
    defaults.current = defaultValue;

    const persist = useCallback(async (value) => {
        await store.set(key, value);
        await store.save();
        await invoke('reload_store');
        const eventKey = key.replaceAll('.', '_').replaceAll('@', ':');
        await emit(`${eventKey}_changed`, value);
        await emit('service_config_changed', key);
    }, [key]);

    const setProperty = useCallback((value, forceSync = false) => {
        const next = typeof value === 'function' ? value(getProperty()) : value;
        setPropertyState(next);
        clearTimeout(timer.current);
        if (forceSync) return persist(next);
        if (sync) timer.current = setTimeout(() => persist(next).catch(console.error), 500);
    }, [persist, sync, getProperty, setPropertyState]);

    useEffect(() => {
        let active = true;
        setPropertyState(null);
        const load = async () => {
            let value = await store.get(key);
            if (value === null) {
                value = defaults.current;
                await persist(value);
            }
            if (active) setPropertyState(value);
        };
        const eventKey = key.replaceAll('.', '_').replaceAll('@', ':');
        // Register before reading so a save during initialization cannot be lost.
        const unlisten = listen(`${eventKey}_changed`, (event) => {
            if (active) setPropertyState(event.payload);
        });
        unlisten.then(load).catch(console.error);
        return () => {
            active = false;
            // Pending preference writes must survive navigation/unmount.
            unlisten.then((stop) => stop());
        };
    }, [key, persist, setPropertyState]);

    return [property, setProperty, getProperty];
};

export const deleteKey = async (key) => {
    if (await store.has(key)) {
        await store.delete(key);
        await store.save();
        await invoke('reload_store');
        await emit('service_config_changed', key);
    }
};
