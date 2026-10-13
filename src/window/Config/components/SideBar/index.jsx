import { useNavigate, useLocation } from 'react-router-dom';
import {
    PiTranslate,
    PiSquaresFour,
    PiTextT,
    PiKeyboard,
    PiPlugs,
    PiClockCounterClockwise,
    PiCloudArrowUp,
    PiInfo,
} from 'react-icons/pi';
import { useTranslation } from 'react-i18next';

const items = [
    ['workspace', PiTranslate],
    ['history', PiClockCounterClockwise],
    ['service', PiPlugs],
    ['hotkey', PiKeyboard],
    ['translate', PiTextT],
    ['recognize', PiSquaresFour],
    ['general', PiSquaresFour],
    ['backup', PiCloudArrowUp],
    ['about', PiInfo],
];
export default function SideBar() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    return (
        <nav
            className='sui-nav'
            aria-label='主导航'
        >
            {items.map(([key, Icon], index) => (
                <button
                    key={key}
                    type='button'
                    className={`sui-nav-item ${location.pathname === `/${key}` ? 'is-active' : ''} ${index === 2 ? 'sui-nav-divider' : ''}`}
                    aria-current={location.pathname === `/${key}` ? 'page' : undefined}
                    onClick={() => navigate(`/${key}`)}
                >
                    <Icon size={20} />
                    <span>{key === 'workspace' ? t('sui.workspace') : t(`config.${key}.label`)}</span>
                </button>
            ))}
        </nav>
    );
}
