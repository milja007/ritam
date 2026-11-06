import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PlaceholderScreenProps = {
  title: string;
  subtitle?: string;
};

// Privremeni ekran dok se značajka ne izgradi. Boje su namjerno minimalne —
// pravi dizajn tokeni dolaze u koraku 4, a tekstovi kroz i18n u koraku 3.
export function PlaceholderScreen({ title, subtitle = 'Uskoro' }: PlaceholderScreenProps) {
  const isDark = useColorScheme() !== 'light';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const mutedColor = isDark ? '#A0A0A8' : '#5C5C66';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B0B10' : '#FFFFFF' }]}>
      <SafeAreaView style={styles.content}>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: mutedColor }]}>{subtitle}</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
  },
});
