import { appConfigDir, join } from '@tauri-apps/api/path';
import { watch } from 'tauri-plugin-fs-watch-api';
import { invoke } from '@tauri-apps/api';

// All windows and native actions share one authoritative, mutex-protected Store.
// Each mutation is persisted before its promise resolves.
export const store = {
    get: (key) => invoke('get_config_value', { key }),
    set: (key, value) => invoke('set_config_value', { key, value }),
    has: (key) => invoke('has_config_value', { key }),
    delete: (key) => invoke('delete_config_value', { key }),
    save: () => Promise.resolve(),
    load: () => invoke('reload_store'),
};

export async function initStore() {
    const path = await join(await appConfigDir(), 'config.json');
    await store.load();
    await watch(path, () => store.load());
}
