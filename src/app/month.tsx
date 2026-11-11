import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/placeholder-screen';

export default function MonthScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.month')} subtitle={t('plans.month')} />;
}
