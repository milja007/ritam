import 'i18next';

import type { resources } from './index';

// Tipizirani ključevi: t('tabs.today') se provjerava pri typechecku.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: (typeof resources)['hr'];
    returnNull: false;
  }
}
