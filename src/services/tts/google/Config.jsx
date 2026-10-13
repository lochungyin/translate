import { Button, Input } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../../../hooks';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';

export function Config({ instanceKey, updateServiceList, onClose }) {
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: 'Google TTS',
            custom_url: 'https://translate.google.com',
        },
        { sync: false }
    );
    if (!config) return null;
    return (
        <form
            onSubmit={async (event) => {
                event.preventDefault();
                await setConfig(config, true);
                updateServiceList(instanceKey);
                onClose();
            }}
        >
            <Input
                className='mb-4'
                label={t('services.instance_name')}
                value={config[INSTANCE_NAME_CONFIG_KEY] ?? ''}
                onValueChange={(value) => setConfig({ ...config, [INSTANCE_NAME_CONFIG_KEY]: value })}
            />
            <Input
                className='mb-4'
                label={t('services.translate.google.custom_url')}
                type='url'
                value={config.custom_url ?? ''}
                placeholder='https://translate.google.com'
                onValueChange={(value) => setConfig({ ...config, custom_url: value })}
            />
            <Button
                type='submit'
                color='primary'
                fullWidth
            >
                {t('common.save')}
            </Button>
        </form>
    );
}
