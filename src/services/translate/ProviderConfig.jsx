import { useState } from 'react';
import { Button, Input, Select, SelectItem } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/api/shell';
import { useConfig } from '../../hooks';
import { translationText } from '../../utils/translation_result';
import { INSTANCE_NAME_CONFIG_KEY } from '../../utils/service_instance';

export default function ProviderConfig({
    service,
    instanceKey,
    updateServiceList,
    onClose,
    translate,
    defaults,
    fields,
}) {
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t(`services.translate.${service}.title`),
            ...defaults,
        },
        { sync: false }
    );
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState('');
    const [failed, setFailed] = useState(false);
    if (!config) return null;
    const test = async () => {
        setTesting(true);
        setMessage('');
        try {
            const result = await translate('Hello, world.', 'auto', service === 'youdao' ? 'zh-CHS' : 'zh-CN', { config });
            const text = translationText(result);
            if (!text.trim()) throw new Error('服务返回了空结果，请检查配置');
            setFailed(false);
            setMessage(`${t('sui.test_ok')} ${text}`);
        } catch (error) {
            setFailed(true);
            setMessage(error.toString());
        } finally {
            setTesting(false);
        }
    };
    return (
        <form
            onSubmit={async (event) => {
                event.preventDefault();
                try {
                    await setConfig({ ...config, enable: true }, true);
                    updateServiceList(instanceKey);
                    onClose();
                } catch (error) {
                    setFailed(true);
                    setMessage(`保存失败：${error}`);
                }
            }}
        >
            <p className='text-sm text-default-500 mb-5'>
                {t(service === 'google' ? 'sui.google_hint' : 'sui.youdao_api_hint')}
            </p>
            <Input
                className='mb-4'
                label={t('services.instance_name')}
                variant='bordered'
                value={config[INSTANCE_NAME_CONFIG_KEY] ?? ''}
                onValueChange={(value) => setConfig({ ...config, [INSTANCE_NAME_CONFIG_KEY]: value })}
            />
            {fields.map(({ key, type, required, labelKey, options, defaultValue }) => type === 'select' ? (
                <Select
                    key={key}
                    className='mb-4'
                    label={t(labelKey)}
                    variant='bordered'
                    selectedKeys={[config[key] ?? (typeof defaultValue === 'function' ? defaultValue(config) : defaultValue)]}
                    disallowEmptySelection
                    onSelectionChange={(keys) => {
                        setMessage('');
                        setConfig({ ...config, [key]: Array.from(keys)[0] });
                    }}
                >
                    {options.map((option) => <SelectItem key={option.key}>{t(option.labelKey)}</SelectItem>)}
                </Select>
            ) : (
                <Input
                    key={key}
                    className='mb-4'
                    label={t(`services.translate.${service}.${key}`)}
                    type={type}
                    isRequired={required}
                    autoComplete={type === 'password' ? 'new-password' : 'off'}
                    variant='bordered'
                    value={config[key] ?? ''}
                    onValueChange={(value) => {
                        setMessage('');
                        setConfig({ ...config, [key]: value });
                    }}
                />
            ))}
            {service === 'youdao' && (
                <Button
                    className='mb-4'
                    size='sm'
                    variant='light'
                    color='primary'
                    onPress={() => open('https://ai.youdao.com/DOCSIRMA/html/trans/api/wbfy/index.html')}
                >
                    {t('sui.youdao_api')}
                </Button>
            )}
            <p className='text-xs text-default-500 mb-4'>{t('sui.save_hint')}</p>
            {message && (
                <p
                    role='status'
                    className={`text-sm mb-4 ${failed ? 'text-danger' : 'text-primary'}`}
                >
                    {message}
                </p>
            )}
            <div className='flex gap-3'>
                <Button
                    variant='bordered'
                    isLoading={testing}
                    onPress={test}
                >
                    {t('sui.test')}
                </Button>
                <Button
                    type='submit'
                    color='primary'
                    className='flex-1'
                >
                    {t('common.save')}
                </Button>
            </div>
        </form>
    );
}
