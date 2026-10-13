import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { appWindow } from '@tauri-apps/api/window';
import { NextUIProvider } from '@nextui-org/react';
import ReactDOM from 'react-dom/client';
import React from 'react';

import { initStore } from './utils/store';
import { initEnv } from './utils/env';
import App from './App';

if (import.meta.env.PROD) {
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

initStore().then(async () => {
    await initEnv();
    const rootElement = document.getElementById('root');
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <NextUIProvider>
            <NextThemesProvider attribute='class'>
                <App />
            </NextThemesProvider>
        </NextUIProvider>
    );
    if (import.meta.env.DEV && import.meta.env.VITE_SUI_NATIVE_SMOKE === '1') {
        import('../tests/native-smoke.jsx').then(({ runNativeSmoke }) => runNativeSmoke());
    }
    if (import.meta.env.DEV && import.meta.env.VITE_SUI_GOOGLE_LIVE === '1') {
        import('../tests/google-live.jsx').then(({ runGoogleLive }) => runGoogleLive());
    }
});
