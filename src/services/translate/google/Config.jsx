import ProviderConfig from '../ProviderConfig';
import { translate } from './index';
import { googleProtocol } from './request';
export function Config(props) {
    return (
        <ProviderConfig
            {...props}
            service='google'
            translate={translate}
            defaults={{ custom_url: 'https://translate.google.com', api_mode: 'web_rpc' }}
            fields={[{ key: 'custom_url', type: 'url' }, {
                key: 'api_mode', type: 'select', labelKey: 'sui.google_protocol', defaultValue: googleProtocol,
                options: [{ key: 'web_rpc', labelKey: 'sui.google_web_rpc' }, { key: 'legacy', labelKey: 'sui.google_legacy' }],
            }]}
        />
    );
}
