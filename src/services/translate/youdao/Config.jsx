import ProviderConfig from '../ProviderConfig';
import { translate } from './index';
export function Config(props) {
    return (
        <ProviderConfig
            {...props}
            service='youdao'
            translate={translate}
            defaults={{ appkey: '', key: '' }}
            fields={[
                { key: 'appkey', type: 'text', required: true },
                { key: 'key', type: 'password', required: true },
            ]}
        />
    );
}
