// Translation keys come from the locale files: a missing or misspelled key breaks the build.
import 'i18next';
import type platform from '@platform/ui/locales/en.json';
import type skyTeam from '@sky/client/locales/en.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'platform';
    resources: { platform: typeof platform; 'sky-team': typeof skyTeam };
  }
}
