import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

// Labeli su zasad hardkodirani (HR); prelaze na i18n u koraku 3.
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'light' ? DefaultTheme : DarkTheme}>
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Danas</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="sun.max" md="today" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="week">
          <NativeTabs.Trigger.Label>Tjedan</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="quests">
          <NativeTabs.Trigger.Label>Questovi</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="flag" md="flag" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="habits">
          <NativeTabs.Trigger.Label>Navike</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="repeat" md="repeat" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
