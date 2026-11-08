/**
 * Vlasnik lokalnih podataka dok ne postoji prijava (Supabase auth dolazi u koraku 18).
 * Nakon prijave lokalni podaci se pripisuju pravom korisniku pri syncu (korak 19).
 */
export const LOCAL_USER_ID = 'local-user';
