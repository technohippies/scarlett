export interface LanguageDef {
  code: string;
  emoji: string;
  i18nKey: string;
  fullName: string;
}

export const languages: LanguageDef[] = [
  { code: 'en', emoji: '🇺🇸', i18nKey: 'langNameEn', fullName: 'English' },
  { code: 'zh', emoji: '🇨🇳', i18nKey: 'langNameZh', fullName: 'Chinese' },
  { code: 'vi', emoji: '🇻🇳', i18nKey: 'langNameVi', fullName: 'Vietnamese' },
  { code: 'ja', emoji: '🇯🇵', i18nKey: 'langNameJa', fullName: 'Japanese' },
  { code: 'ko', emoji: '🇰🇷', i18nKey: 'langNameKo', fullName: 'Korean' },
  { code: 'th', emoji: '🇹🇭', i18nKey: 'langNameTh', fullName: 'Thai' },
  { code: 'id', emoji: '🇮🇩', i18nKey: 'langNameId', fullName: 'Indonesian' },
  { code: 'ar', emoji: '🇸🇦', i18nKey: 'langNameAr', fullName: 'Arabic' },
  { code: 'es', emoji: '🇪🇸', i18nKey: 'langNameEs', fullName: 'Spanish' },
  { code: 'fr', emoji: '🇫🇷', i18nKey: 'langNameFr', fullName: 'French' },
];

export function lookup(code: string): LanguageDef {
  const c = code.toLowerCase();
  return languages.find(l => l.code === c) || { code: c, emoji: '', i18nKey: '', fullName: code };
}

export function normalizeCode(code: string): string {
  const c = code.toLowerCase();
  if (c.startsWith('zh')) return 'zh';
  return c;
} 