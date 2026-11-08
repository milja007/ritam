// `.sql` datoteke se ugrađuju kao string (babel-plugin-inline-import, vidi babel.config.js).
declare module '*.sql' {
  const content: string;
  export default content;
}
