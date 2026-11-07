import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/placeholder-screen';

export default function WeekScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.week')} />;
}
