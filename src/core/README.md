# src/core

Čista TypeScript logika (raspoređivanje, XP, streak, notifikacijski okidači). Bez React importa; svaki modul ima testove.

Testovi: `*.test.ts` uz modul (npr. `time/clock.test.ts`), runner Jest (`jest-expo` preset). Jest API se uvozi eksplicitno: `import { describe, expect, it } from '@jest/globals';`. Pokretanje: `npm test` ili `npm run test:watch`.
