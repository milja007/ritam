import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/ui/placeholder-screen';

export default function HabitsScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('tabs.habits')} />;
}
