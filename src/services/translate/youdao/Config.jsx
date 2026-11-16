import ProviderConfig from '../ProviderConfig';
import { translate } from './index';
import { Language } from './info';

export function Config(props) {
    return (
        <ProviderConfig
            {...props}
            service='youdao'
            translate={translate}
            testTarget={Language.zh_cn}
        />
    );
}
