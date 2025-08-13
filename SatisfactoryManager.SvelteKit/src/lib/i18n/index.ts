import i18n from 'sveltekit-i18n';

/** @type {import('sveltekit-i18n').Config} */
const config = {
  initLocale: 'en',
  fallbackLocale: 'en',
  loaders: [
    {
      locale: 'en',
      key: 'common',
      loader: async () => (await import('./en/common.json')).default,
    },
    {
      locale: 'fr',
      key: 'common',
      loader: async () => (await import('./fr/common.json')).default,
    },
  ],
};

export const { t, locale, locales, loading, loadTranslations } = new i18n(config);

// Helper function to change locale and save preference
export function setLocale(newLocale: string) {
  locale.set(newLocale);
  if (typeof window !== 'undefined') {
    localStorage.setItem('preferred-locale', newLocale);
  }
}

// Helper function to get saved locale preference
export function getSavedLocale(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('preferred-locale') || 'en';
  }
  return 'en';
}

// Helper function to detect browser locale
export function detectBrowserLocale(): string {
  if (typeof window !== 'undefined') {
    const browserLang = navigator.language.slice(0, 2);
    return ['en', 'fr'].includes(browserLang) ? browserLang : 'en';
  }
  return 'en';
}

// Initialize locale on app start
export function initLocale() {
  const savedLocale = getSavedLocale();
  const browserLocale = detectBrowserLocale();
  const initialLocale = savedLocale !== 'en' ? savedLocale : browserLocale;
  setLocale(initialLocale);
}