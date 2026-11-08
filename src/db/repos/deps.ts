import { randomUUID } from 'expo-crypto';

/** Ovisnosti repoa koje se u testovima zamjenjuju (id i sat). */
export interface RepoDeps {
  newId: () => string;
  now: () => Date;
}

export const defaultRepoDeps: RepoDeps = {
  newId: () => randomUUID(),
  now: () => new Date(),
};
