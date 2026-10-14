import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { CardBody } from '@nextui-org/react';
import { Button } from '@nextui-org/react';
import { Input } from '@nextui-org/react';
import { Card } from '@nextui-org/react';
import React from 'react';

import { useConfig } from '../../../../hooks/useConfig';
import { useToastStyle } from '../../../../hooks';
import { osType } from '../../../../utils/env';
import { invoke } from '@tauri-apps/api';

const keyMap = {
    Backquote: '`',
    Backslash: '\\',
    BracketLeft: '[',
    BracketRight: ']',
    Comma: ',',
    Equal: '=',
    Minus: '-',
    Plus: 'PLUS',
    Period: '.',
    Quote: "'",
    Semicolon: ';',
    Slash: '/',
    Backspace: 'Backspace',
    CapsLock: 'Capslock',
    ContextMenu: 'Contextmenu',
    Space: 'Space',
    Tab: 'Tab',
    Convert: 'Convert',
    Delete: 'Delete',
    End: 'End',
    Help: 'Help',
    Home: 'Home',
    PageDown: 'Pagedown',
    PageUp: 'Pageup',
    Escape: 'Esc',
    PrintScreen: 'Printscreen',
    ScrollLock: 'Scrolllock',
    Pause: 'Pause',
    Insert: 'Insert',
    Suspend: 'Suspend',
};

function HotkeyRow({ name, label, fallback }) {
    const [saved, setSaved] = useConfig(name, fallback);
    const [draft, setDraft] = React.useState(null);
    const { t } = useTranslation();
    const toastStyle = useToastStyle();
    function keyDown(e, setKey) {
        e.preventDefault();
        if (e.key === 'Backspace' || e.key === 'Delete') {
            setKey('');
        } else {
            let newValue = '';
            if (e.ctrlKey) {
                newValue = 'Ctrl';
            }
            if (e.shiftKey) {
                newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Shift`;
            }
            if (e.metaKey) {
                newValue = `${newValue}${newValue.length > 0 ? '+' : ''}${osType === 'Darwin' ? 'Command' : 'Super'}`;
            }
            if (e.altKey) {
                newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Alt`;
            }
            let code = e.code;
            if (code.startsWith('Key')) {
                code = code.substring(3);
            } else if (code.startsWith('Digit')) {
                code = code.substring(5);
            } else if (code.startsWith('Numpad')) {
                code = 'Num' + code.substring(6);
            } else if (code.startsWith('Arrow')) {
                code = code.substring(5);
            } else if (code.startsWith('Intl')) {
                code = code.substring(4);
            } else if (/F\d+/.test(code)) {
            } else if (keyMap[code] !== undefined) {
                code = keyMap[code];
            } else {
                code = '';
            }
            setKey(`${newValue}${newValue.length > 0 && code.length > 0 ? '+' : ''}${code}`);
        }
    }


    const apply = async (shortcut = draft ?? saved) => {
        try {
            await invoke('register_shortcut_by_frontend', { name, shortcut });
            await setSaved(shortcut, true);
            setDraft(null);
            toast.success(t('config.hotkey.success'), { style: toastStyle });
        } catch (error) {
            toast.error(error.toString(), { style: toastStyle });
        }
    };
    return saved !== null && (
        <div className='config-item sui-hotkey-row'>
            <h3>{t(label)}</h3>
            <div className='sui-hotkey-controls'>
                <Input
                    aria-label={t(label)}
                    variant='bordered'
                    value={draft ?? saved}
                    label={t('config.hotkey.set_hotkey')}
                    description={saved === '' && draft === null ? t('sui.shortcut_disabled') : null}
                    className='sui-hotkey-input'
                    onKeyDown={(event) => keyDown(event, setDraft)}
                    endContent={<Button size='sm' onPress={() => apply()}>{t('common.ok')}</Button>}
                />
                <Button className='shrink-0' size='sm' variant='flat' onPress={() => apply(fallback)}>{t('sui.shortcut_reset')}</Button>
            </div>
        </div>
    );
}

export default function Hotkey() {
    return <Card><CardBody>
        <HotkeyRow name='hotkey_selection_translate' label='config.hotkey.selection_translate' fallback='Alt+D' />
        <HotkeyRow name='hotkey_input_translate' label='config.hotkey.input_translate' fallback='Alt+A' />
        <HotkeyRow name='hotkey_ocr_recognize' label='config.hotkey.ocr_recognize' fallback='Alt+O' />
        <HotkeyRow name='hotkey_ocr_translate' label='config.hotkey.ocr_translate' fallback='Alt+S' />
    </CardBody></Card>;
}
