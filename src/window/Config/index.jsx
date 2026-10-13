import { useLocation, useRoutes } from 'react-router-dom';
import { useEffect } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import WindowControl from '../../components/WindowControl';
import SideBar from './components/SideBar';
import { osType } from '../../utils/env';
import routes from './routes';
import './style.css';

export default function Config() {
    const { t } = useTranslation();
    const location = useLocation();
    const page = useRoutes(routes);
    const isWorkspace = location.pathname === '/workspace';
    useEffect(() => {
        appWindow.show();
    }, []);
    return (
        <div className='sui-shell'>
            <aside className='sui-sidebar'>
                <div
                    className='sui-brand'
                    data-tauri-drag-region='true'
                >
                    <img
                        src='/icon.svg'
                        alt=''
                        draggable={false}
                    />
                    <div>
                        <strong>随译</strong>
                        <span>Sui Translate</span>
                    </div>
                </div>
                <SideBar />
                <div className='sui-sidebar-footer'>
                    <span>Google + 有道</span>
                    <span>Personal workspace</span>
                </div>
            </aside>
            <main className='sui-main'>
                <header
                    className='sui-titlebar'
                    data-tauri-drag-region='true'
                >
                    <span>{isWorkspace ? t('sui.workspace') : t(`config.${location.pathname.slice(1)}.title`)}</span>
                    {osType !== 'Darwin' && <WindowControl />}
                </header>
                <div className={`sui-content ${isWorkspace ? 'sui-workspace-content' : ''}`}>{page}</div>
            </main>
        </div>
    );
}
