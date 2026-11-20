import { Circle, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetProps } from '../core/widget';

import { RITAM_DAY_PLACEHOLDER } from './placeholder';

/**
 * Widget „Ritam — Dan“ za iOS (korak 41, SwiftUI) — isti sadržaj kao Android
 * (`ritam-day.tsx`). Aktivan tek uz `RITAM_IOS_WIDGET=1` (App Group, plaćeni Apple račun).
 * iOS ima vremensku crtu (`widgetTimeline` iz `core/widget`): Sada / Sljedeće se mijenjaju sami,
 * a u ponoć zapis traži otvaranje appa. Mali widget: rezultat i trenutna/sljedeća aktivnost;
 * srednji dodaje niz, odrađeno/ukupno i ono što slijedi.
 */
const RitamDay = (props: WidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const c = environment.colorScheme === 'dark' ? props.dark : props.light;
  const small = environment.widgetFamily === 'systemSmall';
  const score = props.score === null ? '–' : String(props.score);
  const streak = props.streak > 0 && props.labels.streakUnit ? `${props.streak} ${props.labels.streakUnit}` : '';
  const done = props.total > 0 ? `${props.done}/${props.total}` : '';

  let label = '';
  let title = props.labels.openApp;
  let time = '';
  if (!props.stale) {
    if (props.current) {
      label = props.labels.now;
      title = props.current.title;
      time = `${props.current.start}–${props.current.end}`;
    } else if (props.next) {
      label = props.labels.next;
      title = props.next.title;
      time = props.next.start;
    } else if (props.total === 0) {
      title = props.labels.noPlan;
    } else {
      title = props.labels.dayDone;
    }
  }
  const after =
    !small && !props.stale && props.current && props.next ? `${props.labels.next} ${props.next.start} · ${props.next.title}` : '';
  const meta = small ? '' : [streak, done].filter((part) => part !== '').join(' · ');

  return (
    <VStack alignment="leading" spacing={4} modifiers={[containerBackground(c.background, 'widget')]}>
      <HStack spacing={6}>
        <Circle modifiers={[frame({ width: 10, height: 10 }), foregroundStyle(c.ember ?? c.emberOn)]} />
        <Text modifiers={[font({ size: 20, weight: 'bold', design: 'rounded' }), foregroundStyle(c.text)]}>{score}</Text>
        {meta !== '' ? (
          <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted), lineLimit(1)]}>{meta}</Text>
        ) : null}
        <Spacer />
      </HStack>
      <Spacer />
      {label !== '' ? (
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(c.accent), lineLimit(1)]}>
          {time !== '' ? `${label} · ${time}` : label}
        </Text>
      ) : null}
      <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(c.text), lineLimit(2)]}>{title}</Text>
      {after !== '' ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted), lineLimit(1), padding({ top: 2 })]}>{after}</Text>
      ) : null}
    </VStack>
  );
};

export default createWidget('RitamDay', RitamDay, RITAM_DAY_PLACEHOLDER);
