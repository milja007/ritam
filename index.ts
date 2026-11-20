// Ulaz appa: pozadinski zadatak obavijesti mora biti definiran prije Expo Routera
// (expo-task-manager pokreće bundle u pozadini i traži zadatak u opsegu modula).
import './src/features/notifications/background-task';
// Korak 41 (Android): pozadinsko osvježavanje widgeta — isti razlog.
import './src/features/widget/widget-task';
import 'expo-router/entry';
