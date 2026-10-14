import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@nextui-org/react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@nextui-org/react';
import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/api/fs';
import { Textarea, Button, ButtonGroup } from '@nextui-org/react';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Pagination } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import { getHistoryDatabase, clearHistoryDatabase } from '../../../../utils/history';

import * as builtinCollectionServices from '../../../../services/collection';
import { invoke_plugin } from '../../../../utils/invoke_plugin';
import * as builtinServices from '../../../../services/translate';
import { useConfig, useToastStyle } from '../../../../hooks';
import { LanguageFlag } from '../../../../utils/language';
import { store } from '../../../../utils/store';
import {
    ServiceSourceType,
    ServiceType,
    getServiceName,
    getServiceSouceType,
    whetherAvailableService,
} from '../../../../utils/service_instance';

export default function History() {
    const [collectionServiceList] = useConfig('collection_service_list', []);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [pluginList, setPluginList] = useState(null);
    const [selectedItem, setSelectItem] = useState(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState([]);
    const toastStyle = useToastStyle();
    const { t } = useTranslation();
    useEffect(() => {
        init();
        loadPluginList();
    }, []);

    useEffect(() => {
        getData();
    }, [total, page]);

    const init = async () => {
        const db = await getHistoryDatabase();
        const result = await db.select('SELECT COUNT(*) FROM history');
        if (result[0] && result[0]['COUNT(*)']) {
            setTotal(result[0]['COUNT(*)']);
        }
    };
    const getData = async () => {
        const db = await getHistoryDatabase();
        let result = await db.select('SELECT * FROM history ORDER BY id DESC LIMIT 20 OFFSET $1', [20 * (page - 1)]);
        setItems(result);
    };

    const getSelectedData = async (id) => {
        const db = await getHistoryDatabase();
        let result = await db.select('SELECT * FROM history WHERE id=$1', [id]);
        setSelectItem(result[0]);
    };
    const clearData = async () => {
        const db = await getHistoryDatabase();
        await clearHistoryDatabase(db);
        setItems([]);
        setTotal(0);
        setPage(1);
    };
    const updateData = async () => {
        const db = await getHistoryDatabase();
        await db.execute('UPDATE history SET text=$1, result=$2 WHERE id=$3', [
            selectedItem.text,
            selectedItem.result,
            selectedItem.id,
        ]);
        await getData();
    };

    const formatDate = (date) => {
        function padTo2Digits(num) {
            return num.toString().padStart(2, '0');
        }
        const year = date.getFullYear().toString().slice(2, 4);
        const month = padTo2Digits(date.getMonth() + 1);
        const day = padTo2Digits(date.getDate());
        const hour = padTo2Digits(date.getHours());
        const minute = padTo2Digits(date.getMinutes());
        const second = padTo2Digits(date.getSeconds());
        return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
    };
    const loadPluginList = async () => {
        const serviceTypeList = ['translate', 'collection'];
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

    return (
        pluginList !== null && (
            <div className='sui-history'>
                <Table
                    layout='fixed'
                    fullWidth
                    hideHeader
                    selectionMode='single'
                    selectionBehavior='toggle'
                    aria-label='History Table'
                    classNames={{
                        base: 'sui-history-table',
                        wrapper: 'sui-history-table-wrapper',
                        table: 'sui-history-grid',
                        td: 'px-0',
                    }}
                    onRowAction={(id) => {
                        getSelectedData(id);
                        onOpen();
                    }}
                >
                    <TableHeader>
                        <TableColumn key='service' />
                        <TableColumn key='text' />
                        <TableColumn key='source' />
                        <TableColumn key='target' />
                        <TableColumn key='result' />
                        <TableColumn key='timestamp' />
                    </TableHeader>
                    <TableBody
                        emptyContent={'No History to display.'}
                        items={items}
                    >
                        {(item) =>
                            whetherAvailableService(item.service, {
                                [ServiceSourceType.BUILDIN]: builtinServices,
                                [ServiceSourceType.PLUGIN]: pluginList[ServiceType.TRANSLATE],
                            }) && (
                                <TableRow key={item.id}>
                                    <TableCell className='sui-history-icon'>
                                        {getServiceSouceType(item.service) === ServiceSourceType.PLUGIN ? (
                                            <img
                                                src={pluginList['translate'][getServiceName(item.service)].icon}
                                                className='h-[18px] w-[18px] my-auto mr-[8px]'
                                                draggable={false}
                                            />
                                        ) : (
                                            <img
                                                src={`${builtinServices[getServiceName(item.service)].info.icon}`}
                                                className='h-[18px] w-[18px] my-auto mr-[8px]'
                                                draggable={false}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <p className='sui-history-text' title={item.text}>
                                            {item.text}
                                        </p>
                                    </TableCell>
                                    <TableCell className='sui-history-language'>
                                        <span className={`w-[30px] fi fi-${LanguageFlag[item.source]}`} />
                                    </TableCell>
                                    <TableCell className='sui-history-language'>
                                        <span className={`w-[30px] fi fi-${LanguageFlag[item.target]}`} />
                                    </TableCell>
                                    <TableCell>
                                        <p className='sui-history-text' title={item.result}>
                                            {item.result}
                                        </p>
                                    </TableCell>
                                    <TableCell className='sui-history-date'>
                                        <p className='text-center whitespace-nowrap'>
                                            {formatDate(new Date(item.timestamp))}
                                        </p>
                                    </TableCell>
                                </TableRow>
                            )
                        }
                    </TableBody>
                </Table>
                <div className='sui-history-actions'>
                    <Pagination
                        showControls
                        isCompact
                        total={Math.max(1, Math.ceil(total / 20))}
                        page={page}
                        onChange={setPage}
                    />
                    <Button
                        size='sm'
                        className='my-auto'
                        onPress={clearData}
                    >
                        {t('common.clear')}
                    </Button>
                </div>

                <Modal
                    isOpen={isOpen}
                    onOpenChange={onOpenChange}
                    scrollBehavior='inside'
                >
                    <ModalContent className='max-h-[80vh]'>
                        {(onClose) =>
                            selectedItem && (
                                <>
                                    <ModalHeader>
                                        <div className='flex justify-start'>
                                            {getServiceSouceType(selectedItem.service) === ServiceSourceType.PLUGIN ? (
                                                <img
                                                    src={
                                                        pluginList['translate'][getServiceName(selectedItem.service)]
                                                            .icon
                                                    }
                                                    className='h-[24px] w-[24px] my-auto'
                                                    draggable={false}
                                                />
                                            ) : (
                                                <img
                                                    src={`${builtinServices[getServiceName(selectedItem.service)].info.icon}`}
                                                    className='h-[24px] w-[24px] m-auto mr-[8px]'
                                                    draggable={false}
                                                />
                                            )}
                                        </div>
                                    </ModalHeader>
                                    <ModalBody>
                                        <Textarea
                                            value={selectedItem.text}
                                            onChange={(e) => {
                                                setSelectItem({ ...selectedItem, text: e.target.value });
                                            }}
                                        />
                                        <Textarea
                                            value={selectedItem.result}
                                            onChange={(e) => {
                                                setSelectItem({ ...selectedItem, result: e.target.value });
                                            }}
                                        />
                                    </ModalBody>
                                    <ModalFooter className='flex justify-between'>
                                        <Button
                                            color='primary'
                                            onPress={async () => {
                                                await updateData();
                                                onClose();
                                            }}
                                        >
                                            {t('common.save')}
                                        </Button>
                                        <ButtonGroup>
                                            {collectionServiceList &&
                                                collectionServiceList.map((instanceKey) => {
                                                    return (
                                                        <Button
                                                            key={instanceKey}
                                                            isIconOnly
                                                            variant='light'
                                                            onPress={async () => {
                                                                if (
                                                                    getServiceSouceType(instanceKey) ===
                                                                    ServiceSourceType.PLUGIN
                                                                ) {
                                                                    const pluginConfig =
                                                                        (await store.get(instanceKey)) ?? {};
                                                                    let [func, utils] = await invoke_plugin(
                                                                        'collection',
                                                                        getServiceName(instanceKey)
                                                                    );
                                                                    func(selectedItem.text, selectedItem.result, {
                                                                        config: pluginConfig,
                                                                        utils,
                                                                    }).then(
                                                                        (_) => {
                                                                            toast.success(
                                                                                t('translate.add_collection_success'),
                                                                                {
                                                                                    style: toastStyle,
                                                                                }
                                                                            );
                                                                        },
                                                                        (e) => {
                                                                            toast.error(e.toString(), {
                                                                                style: toastStyle,
                                                                            });
                                                                        }
                                                                    );
                                                                } else {
                                                                    const instanceConfig =
                                                                        (await store.get(instanceKey)) ?? {};
                                                                    builtinCollectionServices[
                                                                        getServiceName(instanceKey)
                                                                    ]
                                                                        .collection(
                                                                            selectedItem.text,
                                                                            selectedItem.result,
                                                                            {
                                                                                config: instanceConfig,
                                                                            }
                                                                        )
                                                                        .then(
                                                                            (_) => {
                                                                                toast.success(
                                                                                    t(
                                                                                        'translate.add_collection_success'
                                                                                    ),
                                                                                    {
                                                                                        style: toastStyle,
                                                                                    }
                                                                                );
                                                                            },
                                                                            (e) => {
                                                                                toast.error(e.toString(), {
                                                                                    style: toastStyle,
                                                                                });
                                                                            }
                                                                        );
                                                                }
                                                            }}
                                                        >
                                                            <img
                                                                src={
                                                                    getServiceSouceType(instanceKey) ===
                                                                    ServiceSourceType.PLUGIN
                                                                        ? pluginList['collection'][
                                                                              getServiceName(instanceKey)
                                                                          ].icon
                                                                        : builtinCollectionServices[
                                                                              getServiceName(instanceKey)
                                                                          ].info.icon
                                                                }
                                                                className='h-[24px] w-[24px]'
                                                            />
                                                        </Button>
                                                    );
                                                })}
                                        </ButtonGroup>
                                    </ModalFooter>
                                </>
                            )
                        }
                    </ModalContent>
                </Modal>
            </div>
        )
    );
}
