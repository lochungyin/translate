import { Button } from '@nextui-org/react';
import { appLogDir, appConfigDir } from '@tauri-apps/api/path';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/api/shell';
import { appVersion } from '../../../../utils/env';

export default function About() {
    const { t } = useTranslation();
    return (
        <div className='sui-about'>
            <img
                src='/icon.svg'
                alt='随译'
            />
            <h1>
                随译 <span className='text-sm font-normal text-default-500'>Sui Translate {appVersion}</span>
            </h1>
            <p>{t('sui.about')}</p>
            <p>{t('sui.about_body')}</p>
            <div className='sui-about-actions'>
                <Button
                    size='sm'
                    variant='bordered'
                    onPress={async () => open(await appLogDir())}
                >
                    {t('sui.logs')}
                </Button>
                <Button
                    size='sm'
                    variant='bordered'
                    onPress={async () => open(await appConfigDir())}
                >
                    {t('sui.config')}
                </Button>
            </div>
            <div className='sui-about-attribution'>
                <p>{t('sui.attribution')}</p>
                <Button
                    size='sm'
                    color='primary'
                    variant='flat'
                    onPress={() => open('https://github.com/pot-app/pot-desktop')}
                >
                    {t('sui.upstream')}
                </Button>
            </div>
        </div>
    );
}
