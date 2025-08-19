import {
	register,
	init,
	getLocaleFromNavigator,
	locale,
	_,
	isLoading,
	waitLocale
} from 'svelte-i18n';
import { browser } from '$app/environment';

const defaultLocale = 'en';
const supportedLocales = ['en', 'fr'];

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
		return browserLocale && supportedLocales.includes(browserLocale.slice(0, 2))
			? browserLocale.slice(0, 2)
			: defaultLocale;
	}
	return defaultLocale;
}

// Get initial locale based on context
function getInitialLocale(): string {
	if (browser) {
		const savedLocale = getSavedLocale();
		if (savedLocale && supportedLocales.includes(savedLocale)) {
			return savedLocale;
		}
		return detectBrowserLocale();
	}
	return defaultLocale;
}

// Initialize i18n with dynamic initial locale
init({
	fallbackLocale: defaultLocale,
	initialLocale: getInitialLocale()
});

// Initialize locale preferences on client side
export function initClientLocale() {
	if (browser) {
		const savedLocale = getSavedLocale();
		const browserLocale = detectBrowserLocale();
		const preferredLocale = savedLocale || browserLocale;

		if (preferredLocale !== defaultLocale) {
			locale.set(preferredLocale);
		}
	}
}

// Helper function to change locale and save preference
export function setLocale(newLocale: string) {
	if (supportedLocales.includes(newLocale)) {
		locale.set(newLocale);
		if (browser) {
			localStorage.setItem('preferred-locale', newLocale);
		}
	}
}

// Export the translation function, locale store, and utilities
export { locale, _ as t, isLoading, waitLocale };
