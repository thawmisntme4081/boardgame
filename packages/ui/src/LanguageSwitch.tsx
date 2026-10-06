import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger } from './components/select';
import { currentLanguage, LANGUAGES, setLanguage, type Language } from './i18n';
import { cn } from './utils';

/** English / Tiếng Việt / Français. Each player picks their own; the choice stays on this device. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  return (
    <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
      <SelectTrigger
        aria-label={t('app.language')}
        className={cn('h-11 gap-1 px-2 text-sm font-medium uppercase', className)}
      >
        <Languages className="size-4" aria-hidden="true" />
        {language}
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {(Object.keys(LANGUAGES) as Language[]).map((code) => (
          <SelectItem key={code} value={code} lang={code}>
            {LANGUAGES[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
