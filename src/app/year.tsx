import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/placeholder-screen';

export default function YearScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.year')} subtitle={t('plans.year')} />;
}
