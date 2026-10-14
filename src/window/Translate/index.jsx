import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/api/fs';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { appWindow, currentMonitor } from '@tauri-apps/api/window';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { Spacer, Button } from '@nextui-org/react';
import { AiFillCloseCircle } from 'react-icons/ai';
import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { BsPinFill } from 'react-icons/bs';

import LanguageArea from './components/LanguageArea';
import SourceArea from './components/SourceArea';
import TargetArea from './components/TargetArea';
import { osType } from '../../utils/env';
import { useConfig } from '../../hooks';
import { store } from '../../utils/store';
import { info } from 'tauri-plugin-log-api';

let resizeTimeout = null;
let moveTimeout = null;

export default function Translate({ embedded = false }) {
    const [closeOnBlur] = useConfig('translate_close_on_blur', true);
    const [alwaysOnTop] = useConfig('translate_always_on_top', false);
    const [windowPosition] = useConfig('translate_window_position', 'mouse');
    const [rememberWindowSize] = useConfig('translate_remember_window_size', false);
    const [translateServiceInstanceList, setTranslateServiceInstanceList] = useConfig('translate_service_list', [
        'google',
        'youdao',
    ]);
    const [recognizeServiceInstanceList] = useConfig('recognize_service_list', ['system', 'tesseract']);
    const [ttsServiceInstanceList] = useConfig('tts_service_list', ['google_tts']);
    const [collectionServiceInstanceList] = useConfig('collection_service_list', []);
    const [hideLanguage] = useConfig('hide_language', false);
    const [pined, setPined] = useState(false);
    const [pluginList, setPluginList] = useState(null);
    const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState(null);
    const reorder = (list, startIndex, endIndex) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };

    const onDragEnd = async (result) => {
        if (!result.destination) return;
        const items = reorder(translateServiceInstanceList, result.source.index, result.destination.index);
        setTranslateServiceInstanceList(items);
    };
    useEffect(() => {
        if (embedded || closeOnBlur === null) return;
        let timer;
        const stops = [appWindow.listen('tauri://blur', () => {
            if (closeOnBlur && !pined && appWindow.label === 'translate') {
                timer = setTimeout(() => appWindow.close(), 100);
            }
        }), appWindow.listen('tauri://focus', () => clearTimeout(timer)), appWindow.listen('tauri://move', () => clearTimeout(timer))];
        return () => { clearTimeout(timer); stops.forEach((stop) => stop.then((fn) => fn())); };
    }, [embedded, closeOnBlur, pined]);
    useEffect(() => {
        if (!embedded && alwaysOnTop !== null) {
            appWindow.setAlwaysOnTop(alwaysOnTop);
            setPined(alwaysOnTop);
        }
    }, [embedded, alwaysOnTop]);
    // 保存窗口位置
    useEffect(() => {
        if (!embedded && windowPosition !== null && windowPosition === 'pre_state') {
            const unlistenMove = appWindow.listen('tauri://move', async () => {
                if (moveTimeout) {
                    clearTimeout(moveTimeout);
                }
                moveTimeout = setTimeout(async () => {
                    if (appWindow.label === 'translate') {
                        let position = await appWindow.outerPosition();
                        const monitor = await currentMonitor();
                        const factor = monitor.scaleFactor;
                        position = position.toLogical(factor);
                        await store.set('translate_window_position_x', parseInt(position.x));
                        await store.set('translate_window_position_y', parseInt(position.y));
                        await store.save();
                    }
                }, 100);
            });
            return () => {
                unlistenMove.then((f) => {
                    f();
                });
            };
        }
    }, [windowPosition]);
    // 保存窗口大小
    useEffect(() => {
        if (!embedded && rememberWindowSize !== null && rememberWindowSize) {
            const unlistenResize = appWindow.listen('tauri://resize', async () => {
                if (resizeTimeout) {
                    clearTimeout(resizeTimeout);
                }
                resizeTimeout = setTimeout(async () => {
                    if (appWindow.label === 'translate') {
                        let size = await appWindow.outerSize();
                        const monitor = await currentMonitor();
                        const factor = monitor.scaleFactor;
                        size = size.toLogical(factor);
                        await store.set('translate_window_height', parseInt(size.height));
                        await store.set('translate_window_width', parseInt(size.width));
                        await store.save();
                    }
                }, 100);
            });
            return () => {
                unlistenResize.then((f) => {
                    f();
                });
            };
        }
    }, [rememberWindowSize]);

    const loadPluginList = async () => {
        const serviceTypeList = ['translate', 'tts', 'recognize', 'collection'];
        let temp = {};
        for (const serviceType of serviceTypeList) {
            temp[serviceType] = {};
            if (await exists(`plugins/${serviceType}`, { dir: BaseDirectory.AppConfig })) {
                const plugins = await readDir(`plugins/${serviceType}`, { dir: BaseDirectory.AppConfig });
                for (const plugin of plugins) {
                    const infoStr = await readTextFile(`plugins/${serviceType}/${plugin.name}/info.json`, {
                        dir: BaseDirectory.AppConfig,
                    });
                    let pluginInfo = JSON.parse(infoStr);
                    if ('icon' in pluginInfo) {
                        const appConfigDirPath = await appConfigDir();
                        const iconPath = await join(
                            appConfigDirPath,
                            `/plugins/${serviceType}/${plugin.name}/${pluginInfo.icon}`
                        );
                        pluginInfo.icon = convertFileSrc(iconPath);
                    }
                    temp[serviceType][plugin.name] = pluginInfo;
                }
            }
        }
        setPluginList({ ...temp });
    };

    useEffect(() => {
        loadPluginList();
        const unlisten = listen('reload_plugin_list', loadPluginList);
        return () => { unlisten.then((stop) => stop()); };
    }, []);

    const loadServiceInstanceConfigMap = async () => {
        if (!translateServiceInstanceList || !recognizeServiceInstanceList || !ttsServiceInstanceList || !collectionServiceInstanceList) return;
        const config = {};
        for (const serviceInstanceKey of translateServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of recognizeServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of ttsServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        for (const serviceInstanceKey of collectionServiceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        setServiceInstanceConfigMap({ ...config });
    };
    useEffect(() => {
        const unlistenConfig = listen('service_config_changed', (event) => {
            if ([...(translateServiceInstanceList ?? []), ...(recognizeServiceInstanceList ?? []), ...(ttsServiceInstanceList ?? []), ...(collectionServiceInstanceList ?? [])].includes(event.payload)) loadServiceInstanceConfigMap();
        });
        return () => { unlistenConfig.then((stop) => stop()); };
    }, [translateServiceInstanceList, recognizeServiceInstanceList, ttsServiceInstanceList, collectionServiceInstanceList]);
    useEffect(() => {
        if (
            translateServiceInstanceList !== null &&
            recognizeServiceInstanceList !== null &&
            ttsServiceInstanceList !== null &&
            collectionServiceInstanceList !== null
        ) {
            loadServiceInstanceConfigMap();
        }
    }, [
        translateServiceInstanceList,
        recognizeServiceInstanceList,
        ttsServiceInstanceList,
        collectionServiceInstanceList,
    ]);

    return (
        pluginList && (
            <div
                className={
                    embedded
                        ? 'sui-embedded-translate'
                        : `sui-popup bg-background ${
                              osType === 'Linux' && 'rounded-[10px] border-1 border-default-100'
                          }`
                }
            >
                {!embedded && (
                    <>
                        <div
                            className='fixed top-[5px] left-[5px] right-[5px] h-[30px]'
                            data-tauri-drag-region='true'
                        />
                        <div
                            className={`sui-popup-titlebar h-[35px] w-full flex ${osType === 'Darwin' ? 'justify-end' : 'justify-between'}`}
                        >
                            <Button
                                isIconOnly
                                size='sm'
                                variant='flat'
                                disableAnimation
                                className='my-auto bg-transparent'
                                onPress={() => {
                            appWindow.setAlwaysOnTop(!pined);
                            setPined(!pined);
                                }}
                            >
                                <BsPinFill className={`text-[20px] ${pined ? 'text-primary' : 'text-default-400'}`} />
                            </Button>
                            <Button
                                isIconOnly
                                size='sm'
                                variant='flat'
                                disableAnimation
                                className={`my-auto ${osType === 'Darwin' && 'hidden'} bg-transparent`}
                                onPress={() => {
                                    void appWindow.close();
                                }}
                            >
                                <AiFillCloseCircle className='text-[20px] text-default-400' />
                            </Button>
                        </div>
                    </>
                )}
                <div
                    className={
                        embedded
                            ? 'sui-embedded-body'
                            : 'sui-popup-body px-[8px]'
                    }
                >
                    <div className={embedded ? 'sui-embedded-scroll' : 'sui-popup-scroll'}>
                        <div>
                            {serviceInstanceConfigMap !== null && (
                                <SourceArea
                                    embedded={embedded}
                                    pluginList={pluginList}
                                    serviceInstanceConfigMap={serviceInstanceConfigMap}
                                />
                            )}
                        </div>
                        <div className={`${hideLanguage && 'hidden'}`}>
                            <LanguageArea />
                            <Spacer y={2} />
                        </div>
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable
                                droppableId='droppable'
                                direction='vertical'
                            >
                                {(provided) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                    >
                                        {translateServiceInstanceList !== null &&
                                            serviceInstanceConfigMap !== null &&
                                            translateServiceInstanceList.map((serviceInstanceKey, index) => {
                                                const config = serviceInstanceConfigMap[serviceInstanceKey] ?? {};
                                                const enable = config['enable'] ?? true;

                                                return enable ? (
                                                    <Draggable
                                                        key={serviceInstanceKey}
                                                        draggableId={serviceInstanceKey}
                                                        index={index}
                                                    >
                                                        {(provided) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                            >
                                                                <TargetArea
                                                                    {...provided.dragHandleProps}
                                                                    index={index}
                                                                    name={serviceInstanceKey}
                                                                    translateServiceInstanceList={
                                                                        translateServiceInstanceList
                                                                    }
                                                                    pluginList={pluginList}
                                                                    serviceInstanceConfigMap={serviceInstanceConfigMap}
                                                                />
                                                                <Spacer y={2} />
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ) : (
                                                    <></>
                                                );
                                            })}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>
                </div>
            </div>
        )
    );
}
