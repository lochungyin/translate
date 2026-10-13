import { Button, Switch, Tooltip } from '@nextui-org/react';
import { PiCornersOut, PiTextT, PiArrowSquareOut, PiSlidersHorizontal } from 'react-icons/pi';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api';
import { appWindow } from '@tauri-apps/api/window';
import toast from 'react-hot-toast';
import Translate from '../../../Translate';
import { useConfig, useToastStyle } from '../../../../hooks';

export default function Workspace() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [clipboard, setClipboard] = useConfig('clipboard_monitor', false);
    const [youdao] = useConfig('youdao', {});
    const [selectionHotkey] = useConfig('hotkey_selection_translate', 'Alt+D');
    const [screenshotHotkey] = useConfig('hotkey_ocr_translate', 'Alt+S');
    const toastStyle = useToastStyle();
    const run = async (action) => {
        try {
            const started = await invoke('run_action', { action });
            if (!started) await appWindow.show();
        } catch (error) {
            await appWindow.show();
            toast.error(error.toString(), { style: toastStyle });
        }
    };
    return (
        <div className='sui-workspace'>

            <div className='sui-workspace-heading'>
                <div>
                    <h1>{t('sui.workspace')}</h1>
                    <p>{t('sui.subtitle')}</p>
                </div>
                <Tooltip content={t('sui.clipboard_hint')}>
                    <div>
                        <Switch
                            size='sm'
                            isSelected={clipboard ?? false}
                            onValueChange={async (value) => {
                                try {
                                    await invoke('set_clipboard_monitor', { enabled: value });
                                    setClipboard(value);
                                } catch (error) {
                                    toast.error(error.toString(), { style: toastStyle });
                                }
                            }}
                        >
                            {t('sui.clipboard')}
                        </Switch>
                    </div>
                </Tooltip>
            </div>
            <div className='sui-actions'>
                <Button
                    variant='bordered'
                    size='sm'
                    startContent={<PiCornersOut size={17} />}
                    onPress={() => run('ocr_translate')}
                >
                    {t('sui.screenshot')}
                </Button>
                <Button
                    variant='bordered'
                    size='sm'
                    startContent={<PiTextT size={17} />}
                    onPress={() => run('ocr_recognize')}
                >
                    {t('sui.ocr')}
                </Button>
                <Button
                    variant='bordered'
                    size='sm'
                    startContent={<PiArrowSquareOut size={17} />}
                    onPress={() => run('input_translate')}
                >
                    {t('sui.floating')}
                </Button>
                <Button
                    variant='light'
                    size='sm'
                    className='sui-service-link'
                    startContent={<PiSlidersHorizontal size={17} />}
                    onPress={() => navigate('/service')}
                >
                    {t('sui.services')}
                </Button>
            </div>
            <Translate embedded />
            {youdao && (!youdao.appkey || !youdao.key) && (
                <div className='sui-setup-note'>
                    <img
                        src='/logo/youdao.svg'
                        alt=''
                    />
                    <div>
                        <strong>{t('sui.youdao_setup')}</strong>
                        <p>{t('sui.youdao_hint')}</p>
                    </div>
                    <Button
                        size='sm'
                        color='primary'
                        variant='flat'
                        onPress={() => navigate('/service')}
                    >
                        {t('sui.configure')}
                    </Button>
                </div>
            )}
            <footer className='sui-shortcut-note'>
                <span>
                    {t('sui.selection')} <kbd>{selectionHotkey || '未设置'}</kbd>
                </span>
                <span>
                    {t('sui.screenshot')} <kbd>{screenshotHotkey || '未设置'}</kbd>
                </span>
                <button onClick={() => navigate('/hotkey')}>{t('sui.shortcuts')}</button>
            </footer>
        </div>
    );
}
