import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Živi sat za "Trenutno" (17c): novi `Date` na svaku punu sekundu, samo dok je ekran
 * u fokusu i app u prvom planu (bez tikanja u pozadini — štedi bateriju).
 */
export function useLiveClock(): Date {
  const [now, setNow] = useState(() => new Date());
  const [focused, setFocused] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!focused || !active) return;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = new Date();
      setNow(current);
      // Poravnanje na punu sekundu, da sat ne "preskače".
      timeout = setTimeout(tick, 1000 - current.getMilliseconds() + 5);
    };
    tick();
    return () => clearTimeout(timeout);
  }, [focused, active]);

  return now;
}
