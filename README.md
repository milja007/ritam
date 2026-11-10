# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Ritam na iPhoneu (development build, besplatni Apple ID)

Treba: Mac s Xcodeom ≥ 26.4 (licenca prihvaćena, Apple ID prijavljen u Xcode → Settings → Accounts), iPhone s uključenim Developer Modeom, spojen kabelom i otključan, na istoj Wi-Fi mreži kao Mac.

```bash
npm ci
LANG=en_US.UTF-8 npx expo run:ios --device
```

`run:ios` generira `ios/` (CNG, nije u gitu), instalira podove, gradi i instalira app (pri prvom pokretanju odaberi svoj osobni tim). Ako CocoaPods padne na `UnicodeNormalize`, nedostaje `LANG=en_US.UTF-8`.

Prvi put na iPhoneu: **Postavke → Općenito → VPN i upravljanje uređajem → Apple Development: … → Vjeruj**.

Svakodnevno: `npx expo start --dev-client` na Macu, pa otvori Ritam na iPhoneu (promjene JS koda stižu bez novog builda; novi build samo kad se mijenjaju nativni paketi ili `app.json`).

Besplatni profil vrijedi **7 dana** — nakon toga ponovi `npx expo run:ios --device`. EAS build / TestFlight (`eas.json`, profil `development`) tek uz plaćeni Apple Developer Program: `npx eas-cli login`, `eas device:create`, `eas build --profile development --platform ios`.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
