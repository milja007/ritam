import { useTranslation } from 'react-i18next';

import { shiftClock, TIME_STEP_MINUTES } from '@/core/onboarding';

import { Stepper } from './stepper';

/** Stepper za vrijeme "HH:MM" u koracima od 15 min (preko ponoći se omata). */
export function ClockStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const shift = (delta: number) => {
    const next = shiftClock(value, delta);
    if (next !== null) onChange(next);
  };
  return (
    <Stepper
      label={label}
      value={value}
      onDecrease={() => shift(-TIME_STEP_MINUTES)}
      onIncrease={() => shift(TIME_STEP_MINUTES)}
      decreaseLabel={t('onboarding.decrease', { label })}
      increaseLabel={t('onboarding.increase', { label })}
    />
  );
}
