import { Box, Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, fillMaxWidth, paddingAll, size } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetProps } from '../core/widget';

import { RITAM_DAY_PLACEHOLDER } from './placeholder';

/**
 * Widget „Ritam — Dan“ (korak 41, Android): žar i rezultat dana, niz, odrađeno/ukupno, Sada i
 * Sljedeće s vremenima. Crta se u izoliranom runtimeu (direktiva `'widget'`): bez hookova, bez
 * i18n-a i bez ičega izvan funkcije — sve tekstove i boje šalje app (`src/core/widget`).
 * Android nema vremensku crtu, pa su uz aktivnosti vremena i datum dana: zastarjela snimka ne
 * vara (app je osvježi dok radi, `WidgetSync`).
 */
const RitamDay = (props: WidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const c = environment.colorScheme === 'dark' ? props.dark : props.light;
  const parts = props.date.split('-');
  const day = parts.length === 3 ? `${Number(parts[2])}. ${Number(parts[1])}.` : '';
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
  const after = !props.stale && props.current && props.next ? `${props.labels.next} ${props.next.start} · ${props.next.title}` : '';

  return (
    <Column modifiers={[fillMaxSize(), background(c.background), cornerRadius(22), paddingAll(14)]}>
      <Row modifiers={[fillMaxWidth()]} verticalAlignment="center">
        <Box modifiers={[size(12, 12), cornerRadius(6), background(c.ember ?? c.emberOn)]} />
        <Spacer modifiers={[size(8, 1)]} />
        <Text color={c.text} style={{ fontSize: 20, fontWeight: 'bold' }}>
          {score}
        </Text>
        <Spacer modifiers={[size(10, 1)]} />
        <Text color={c.muted} style={{ fontSize: 12 }} maxLines={1}>
          {[streak, done].filter((part) => part !== '').join(' · ')}
        </Text>
        <Text color={c.muted} style={{ fontSize: 12, textAlign: 'end' }} modifiers={[fillMaxWidth()]}>
          {day}
        </Text>
      </Row>
      <Spacer modifiers={[size(1, 10)]} />
      {label !== '' ? (
        <Text color={c.accent} style={{ fontSize: 12, fontWeight: '600' }}>
          {time !== '' ? `${label} · ${time}` : label}
        </Text>
      ) : null}
      <Text color={c.text} style={{ fontSize: 16, fontWeight: '600' }} maxLines={2}>
        {title}
      </Text>
      {after !== '' ? (
        <Text color={c.muted} style={{ fontSize: 12 }} maxLines={1}>
          {after}
        </Text>
      ) : null}
    </Column>
  );
};

export default createWidget('RitamDay', RitamDay, RITAM_DAY_PLACEHOLDER);
