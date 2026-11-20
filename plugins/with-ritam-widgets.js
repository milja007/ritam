/**
 * Korak 41 (odluka 94a): home-screen widget preko `expo-widgets`.
 *
 * Android widget se dodaje uvijek. iOS widget traži App Group, a to besplatni Apple ID (osobni
 * tim) ne podržava — potpisivanje bi palo. Zato se iOS cilj i App Group dodaju **samo** uz
 * `RITAM_IOS_WIDGET=1` (kad je Apple Developer Program aktivan i App Group stvoren na Macu).
 * Bez zastavice iOS build ostaje kakav je bio.
 */
const { createRunOncePlugin } = require('expo/config-plugins');

const withWidgets = require('expo-widgets/app.plugin').default;
const withAndroidWidgets = require('expo-widgets/plugin/build/android/withAndroidWidgets').default;

function iosWidgetEnabled() {
  return process.env.RITAM_IOS_WIDGET === '1';
}

const withRitamWidgets = (config, props) => {
  if (iosWidgetEnabled()) return withWidgets(config, { ...props, enableAndroid: true });
  return withAndroidWidgets(config, { ...props, widgets: props?.widgets ?? [] });
};

module.exports = createRunOncePlugin(withRitamWidgets, 'with-ritam-widgets', '1.0.0');
