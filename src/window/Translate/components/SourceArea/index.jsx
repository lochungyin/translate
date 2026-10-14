import { Button, Card, CardBody, CardFooter, ButtonGroup, Chip, Tooltip, Spacer } from '@nextui-org/react';
import { BaseDirectory, readTextFile } from '@tauri-apps/api/fs';
import React, { useEffect, useRef, useState } from 'react';
import { writeText } from '@tauri-apps/api/clipboard';
import { HiOutlineVolumeUp } from 'react-icons/hi';
import { appWindow } from '@tauri-apps/api/window';
import toast from 'react-hot-toast';
import { listen } from '@tauri-apps/api/event';
import { MdContentCopy } from 'react-icons/md';
import { MdSmartButton } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { HiTranslate } from 'react-icons/hi';
import { LuDelete } from 'react-icons/lu';
import { invoke } from '@tauri-apps/api';
import { atom, useAtom, useSetAtom } from 'jotai';
import { getServiceName, getServiceSouceType, ServiceSourceType } from '../../../../utils/service_instance';
import { useConfig, useSyncAtom, useVoice, useToastStyle, useTextareaAutoHeight } from '../../../../hooks';
import { invoke_plugin } from '../../../../utils/invoke_plugin';
import * as recognizeServices from '../../../../services/recognize';
import * as builtinTtsServices from '../../../../services/tts';
import detect from '../../../../utils/lang_detect';
import { store } from '../../../../utils/store';
import { info } from 'tauri-plugin-log-api';
import { debug } from 'tauri-plugin-log-api';

export const sourceTextAtom = atom('');
export const detectLanguageAtom = atom('');
export const translationRequestAtom = atom(0);


export default function SourceArea(props) {
    const { pluginList, serviceInstanceConfigMap, embedded = false } = props;
    const [appFontSize] = useConfig('app_font_size', 16);
    const [sourceText, setSourceText, syncText] = useSyncAtom(sourceTextAtom);
    const setTranslationRequest = useSetAtom(translationRequestAtom);
    const syncSourceText = () => {
        syncText();
        setTranslationRequest((version) => version + 1);
    };
    const [detectLanguage, setDetectLanguage] = useAtom(detectLanguageAtom);
    const [incrementalTranslate] = useConfig('incremental_translate', false);
    const [dynamicTranslate] = useConfig('dynamic_translate', false);
    const [deleteNewline] = useConfig('translate_delete_newline', false);
    const [recognizeLanguage] = useConfig('recognize_language', 'auto');
    const [recognizeServiceList] = useConfig('recognize_service_list', ['system', 'tesseract']);
    const [ttsServiceList] = useConfig('tts_service_list', ['google_tts']);
    const [hideWindow] = useConfig('translate_hide_window', false);
    const [hideSource] = useConfig('hide_source', false);
    const [ttsPluginInfo, setTtsPluginInfo] = useState();
    const [speaking, setSpeaking] = useState(false);
    const [windowType, setWindowType] = useState(embedded ? '[INPUT_TRANSLATE]' : '[SELECTION_TRANSLATE]');
    const [actionError, setActionError] = useState(null);
    const lastRequestId = useRef(0);
    const toastStyle = useToastStyle();
    const { t } = useTranslation();
    const textAreaRef = useRef();
    const speak = useVoice();

    const handleNewText = async (text, error = null) => {
        setActionError(error);
        if (!embedded) {
            if (hideWindow && !error && text !== '[INPUT_TRANSLATE]') {
                await appWindow.hide();
            } else {
                await appWindow.show();
                await appWindow.setFocus();
            }
        }
        setDetectLanguage('');
        setWindowType(text.startsWith('[') ? text : '[SELECTION_TRANSLATE]');
        if (text === '[INPUT_TRANSLATE]') {
            setSourceText('', true);
            textAreaRef.current?.focus();
            return;
        }
        try {
            if (text === '[IMAGE_TRANSLATE]') {
                const base64 = await invoke('get_base64');
                if (!base64) throw new Error('没有可识别的截图，请重新截图');
                const instanceKey = recognizeServiceList?.[0];
                if (!instanceKey) throw new Error('请先配置文字识别服务');
                const name = getServiceName(instanceKey);
                if (getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN) {
                    const plugin = pluginList.recognize[name];
                    if (!plugin || !(recognizeLanguage in plugin.language)) throw new Error('Language not supported');
                    const [func, utils] = await invoke_plugin('recognize', name);
                    text = await func(base64, plugin.language[recognizeLanguage], {
                        config: serviceInstanceConfigMap[instanceKey], utils,
                    });
                } else {
                    const service = recognizeServices[name];
                    if (!service || !(recognizeLanguage in service.Language)) throw new Error('Language not supported');
                    text = await service.recognize(base64, service.Language[recognizeLanguage], {
                        config: serviceInstanceConfigMap[instanceKey],
                    });
                }
            }
            const newText = deleteNewline ? text.replace(/\-\s+/g, '').replace(/\s+/g, ' ').trim() : text.trim();
            if (!newText) throw new Error('未读取到文字。划词请检查选区及辅助功能权限，截图请确认图片包含文字');
            setSourceText(incrementalTranslate ? (old) => `${old} ${newText}`.trim() : newText);
            await detect_language(newText);
            syncSourceText();
        } catch (error) {
            toast.error(error.toString(), { style: toastStyle });
        }
    };

    const keyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            if (event.nativeEvent.isComposing) return;
            event.preventDefault();
            detect_language(sourceText).then(() => {
                syncSourceText();
            });
        }
        if (event.key === 'Escape') {
            appWindow.close();
        }
    };

    const handleSpeak = async () => {
        await speak.prepare();
        const instanceKey = ttsServiceList?.[0];
        if (!instanceKey) throw new Error('请先配置朗读服务');
        let detected = detectLanguage;
        if (detected === '') {
            detected = await detect(sourceText);
            setDetectLanguage(detected);
        }
        if (getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN) {
            if (!(detected in ttsPluginInfo.language)) {
                throw new Error('Language not supported');
            }
            const pluginConfig = serviceInstanceConfigMap[instanceKey];
            let [func, utils] = await invoke_plugin('tts', getServiceName(instanceKey));
            let data = await func(sourceText, ttsPluginInfo.language[detected], {
                config: pluginConfig,
                utils,
            });
            await speak(data);
        } else {
            if (!(detected in builtinTtsServices[getServiceName(instanceKey)].Language)) {
                throw new Error('Language not supported');
            }
            const instanceConfig = serviceInstanceConfigMap[instanceKey];
            let data = await builtinTtsServices[getServiceName(instanceKey)].tts(
                sourceText,
                builtinTtsServices[getServiceName(instanceKey)].Language[detected],
                {
                    config: instanceConfig,
                }
            );
            await speak(data);
        }
    };

    const handleNewTextRef = useRef(handleNewText);
    handleNewTextRef.current = handleNewText;
    useEffect(() => {
        if (embedded || hideWindow === null || deleteNewline === null || incrementalTranslate === null || !recognizeServiceList || !recognizeLanguage) return;
        let active = true;
        const receive = (request) => {
            if (!active || request.id <= lastRequestId.current) return;
            lastRequestId.current = request.id;
            void handleNewTextRef.current(request.text, request.error);
        };
        const unlisten = appWindow.listen('translation_request', (event) => receive(event.payload));
        // Subscribe before reading the snapshot; ignore a snapshot older than an event.
        unlisten.then(() => invoke('get_translation_request')).then(receive);
        return () => { active = false; unlisten.then((stop) => stop()); };
    }, [embedded, hideWindow !== null && deleteNewline !== null && incrementalTranslate !== null && !!recognizeServiceList && !!recognizeLanguage]);

    useEffect(() => {
        if (ttsServiceList && getServiceSouceType(ttsServiceList[0]) === ServiceSourceType.PLUGIN) {
            readTextFile(`plugins/tts/${getServiceName(ttsServiceList[0])}/info.json`, {
                dir: BaseDirectory.AppConfig,
            }).then((infoStr) => {
                setTtsPluginInfo(JSON.parse(infoStr));
            });
        }
    }, [ttsServiceList]);

    useTextareaAutoHeight(textAreaRef, sourceText, appFontSize);

    const detect_language = async (text) => {
        try {
            setDetectLanguage(await detect(text));
        } catch (error) {
            setDetectLanguage('');
            toast.error(`语言检测失败：${error}`, { style: toastStyle });
        }
    };

    const sourceTextChangeTimer = useRef(null);
    useEffect(() => () => clearTimeout(sourceTextChangeTimer.current), []);
    const changeSourceText = async (text) => {
        setActionError(null);
        setDetectLanguage('');
        await setSourceText(text);
        if (dynamicTranslate) {
            if (sourceTextChangeTimer.current) {
                clearTimeout(sourceTextChangeTimer.current);
            }
            sourceTextChangeTimer.current = setTimeout(() => {
                detect_language(text).then(() => {
                    syncSourceText();
                });
            }, 1000);
        }
    };

    const transformVarName = function (str) {
        let str2 = str;

        // snake_case to SNAKE_CASE
        if (/_[a-z]/.test(str2)) {
            str2 = str2
                .split('_')
                .map((it) => it.toLocaleUpperCase())
                .join('_');
        }
        if (str2 !== str) {
            return str2;
        }

        // SNAKE_CASE to kebab-case
        if (/^[A-Z]+(_[A-Z]+)*$/.test(str2)) {
            str2 = str2
                .split('_')
                .map((it) => it.toLocaleLowerCase())
                .join('-');
        }
        if (str2 !== str) {
            return str2;
        }

        // kebab-case to dot.notation
        if (/-/.test(str2)) {
            str2 = str2
                .split('-')
                .map((it) => it.toLocaleLowerCase())
                .join('.');
        }
        if (str2 !== str) {
            return str2;
        }

        // dot.notation to space separated
        if (/\.[a-z]/.test(str2)) {
            str2 = str2.replaceAll(/(\.)([a-z])/g, (_, _2, it) => ' ' + it);
        }
        if (str2 !== str) {
            return str2;
        }

        // space separated to Title Case
        if (/\s[a-z]/.test(str2)) {
            str2 = str2.replaceAll(/\s([a-z])/g, (_, it) => ' ' + it.toLocaleUpperCase());
            str2 = str2.substring(0, 1).toLocaleUpperCase() + str2.substring(1);
        }
        if (str2 !== str) {
            return str2;
        }

        // Title Case to CamelCase
        if (/\s[A-Z]/.test(str2)) {
            str2 = str2.replaceAll(/\s([A-Z])/g, (_, it) => it);
            str2 = str2.substring(0, 1).toLocaleLowerCase() + str2.substring(1);
        }
        if (str2 !== str) {
            return str2;
        }

        // CamelCase to PascalCase
        if (/^[a-z]+[A-Z]+/.test(str2)) {
            str2 = str2.substring(0, 1).toLocaleUpperCase() + str2.substring(1);
        }
        if (str2 !== str) {
            return str2;
        }

        // PascalCase to snake_case
        if (/[^\s][A-Z]/.test(str2)) {
            str2 = str2.replaceAll(/[A-Z]/g, (it, offset) => {
                return (offset == 0 ? '' : '_') + it.toLocaleLowerCase();
            });
        }

        return str2;
    };
    useEffect(() => {
        textAreaRef.current.addEventListener('keydown', async (event) => {
            if (event.altKey && event.shiftKey && event.code === 'KeyU') {
                const originText = textAreaRef.current.value;
                const selectionStart = textAreaRef.current.selectionStart;
                const selectionEnd = textAreaRef.current.selectionEnd;
                const selectionText = originText.substring(selectionStart, selectionEnd);

                const convertedText = transformVarName(selectionText);
                const targetText =
                    originText.substring(0, selectionStart) + convertedText + originText.substring(selectionEnd);

                await changeSourceText(targetText);
                textAreaRef.current.selectionStart = selectionStart;
                textAreaRef.current.selectionEnd = selectionStart + convertedText.length;
            }
        });
    }, [textAreaRef]);

    return (
        <div className={`sui-source ${!embedded && hideSource && windowType !== '[INPUT_TRANSLATE]' ? 'hidden' : ''}`}>
            {actionError && <div role='alert' className='rounded-lg bg-warning-50 text-warning-800 px-3 py-2 mb-3 text-sm'>{actionError}</div>}
            <div className='sui-source-label'>{t('sui.source')}</div>
            <Card
                shadow='none'
                className='bg-content1 rounded-[10px] mt-[1px] pb-0'
            >

                <CardBody className='sui-source-body bg-content1 p-[12px] pb-0 max-h-[40vh] overflow-y-auto'>
                    <textarea
                        aria-label={t('sui.source')}
                        placeholder={t('sui.source_hint')}
                        autoFocus
                        ref={textAreaRef}
                        className='bg-content1 w-full min-w-0 resize-none outline-none'
                        style={{ fontSize: appFontSize ? `${appFontSize}px` : undefined }}
                        value={sourceText}
                        onKeyDown={keyDown}
                        onChange={(e) => {
                            const v = e.target.value;
                            changeSourceText(v);
                        }}
                    />
                </CardBody>

                <CardFooter as='footer' className='sui-source-toolbar bg-content1 rounded-none rounded-b-[10px] flex justify-between px-[12px] p-[5px]'>
                    <div className='sui-source-tools flex justify-start'>
                        <ButtonGroup className='mr-[5px]'>
                            <Tooltip content={t('translate.speak')}>
                                <Button
                                    isIconOnly
                                    aria-label={t('translate.speak')}
                                    isLoading={speaking}
                                    isDisabled={!sourceText.trim()}
                                    variant='light'
                                    size='sm'
                                    onPress={async () => {
                                        setSpeaking(true);
                                        try { await handleSpeak(); }
                                        catch (error) { toast.error(error.toString(), { style: toastStyle }); }
                                        finally { setSpeaking(false); }
                                    }}
                                >
                                    <HiOutlineVolumeUp className='text-[16px]' />
                                </Button>
                            </Tooltip>
                            <Tooltip content={t('translate.copy')}>
                                <Button
                                    isIconOnly
                                    variant='light'
                                    size='sm'
                                    onPress={() => {
                                        writeText(sourceText);
                                    }}
                                >
                                    <MdContentCopy className='text-[16px]' />
                                </Button>
                            </Tooltip>
                            <Tooltip content={t('translate.delete_newline')}>
                                <Button
                                    isIconOnly
                                    variant='light'
                                    size='sm'
                                    onPress={() => {
                                        const newText = sourceText.replace(/\-\s+/g, '').replace(/\s+/g, ' ');
                                        setSourceText(newText);
                                        detect_language(newText).then(() => {
                                            syncSourceText();
                                        });
                                    }}
                                >
                                    <MdSmartButton className='text-[16px]' />
                                </Button>
                            </Tooltip>
                            <Tooltip content={t('common.clear')}>
                                <Button
                                    variant='light'
                                    size='sm'
                                    isIconOnly
                                    isDisabled={sourceText === ''}
                                    onPress={() => {
                                        setSourceText('', true);
                                        setDetectLanguage('');
                                    }}
                                >
                                    <LuDelete className='text-[16px]' />
                                </Button>
                            </Tooltip>
                        </ButtonGroup>
                        {detectLanguage !== '' && (
                            <Chip
                                size='sm'
                                color='primary'
                                variant='dot'
                                className='my-auto'
                            >
                                {t(`languages.${detectLanguage}`)}
                            </Chip>
                        )}
                    </div>
                    <Tooltip content={t('translate.translate')}>
                        <Button
                            size='sm'
                            color='primary'
                            variant='solid'
                            aria-label={t('sui.translate')}
                            isDisabled={!sourceText.trim()}
                            className='text-[14px] font-medium'
                            startContent={<HiTranslate className='text-[16px]' />}
                            onPress={() => {
                                detect_language(sourceText).then(() => {
                                    syncSourceText();
                                });
                            }}
                        >
                            {t('sui.translate')}
                        </Button>
                    </Tooltip>
                </CardFooter>
            </Card>
            <Spacer y={2} />
        </div>
    );
}
