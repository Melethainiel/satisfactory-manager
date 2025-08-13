import { register, init, getLocaleFromNavigator, locale, _, isLoading } from 'svelte-i18n';
import { browser } from '$app/environment';

// Register translations
register('en', () => import('./en/common.json'));
register('fr', () => import('./fr/common.json'));

// Helper function to get saved locale preference
export function getSavedLocale(): string {
	if (browser) {
		return localStorage.getItem('preferred-locale') || '';
	}
	return '';
}

// Helper function to detect browser locale
export function detectBrowserLocale(): string {
	if (browser) {
		const browserLocale = getLocaleFromNavigator();
		return browserLocale && ['en', 'fr'].includes(browserLocale.slice(0, 2))
			? browserLocale.slice(0, 2)
			: 'en';
	}
	return 'en';
}

// Initialize i18n immediately with default locale
init({
	fallbackLocale: 'en',
	initialLocale: 'en'
});

// Initialize locale preferences on client side
export function initClientLocale() {
	if (browser) {
		const savedLocale = getSavedLocale();
		const browserLocale = detectBrowserLocale();
		const preferredLocale = savedLocale || browserLocale;

		if (preferredLocale !== 'en') {
			locale.set(preferredLocale);
		}
	}
}

// Helper function to change locale and save preference
export function setLocale(newLocale: string) {
	locale.set(newLocale);
	if (browser) {
		localStorage.setItem('preferred-locale', newLocale);
	}
}

// Export the translation function and locale store
export { locale, _ as t, isLoading };
