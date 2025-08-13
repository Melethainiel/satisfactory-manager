import { getContext, setContext } from 'svelte';
import { locale, loadTranslations } from '$lib/i18n';

export interface LocaleState {
	currentLocale: string;
	isLoading: boolean;
	changeLocale: (newLocale: string) => Promise<void>;
}

class LocaleStateClass implements LocaleState {
	currentLocale = $state('en');
	isLoading = $state(false);

	async changeLocale(newLocale: string) {
		if (this.currentLocale === newLocale) return;
		
		this.isLoading = true;
		try {
			// Load translations for the new locale
			await loadTranslations(newLocale, '/');
			
			// Update the locale
			locale.set(newLocale);
			this.currentLocale = newLocale;
			
			// Save preference
			if (typeof window !== 'undefined') {
				localStorage.setItem('preferred-locale', newLocale);
			}
		} catch (error) {
			console.error('Failed to change locale:', error);
		} finally {
			this.isLoading = false;
		}
	}
}

const DEFAULT_LOCALE_STATE_KEY = '$_locale_state';

export const getLocaleState = (key = DEFAULT_LOCALE_STATE_KEY): LocaleState => getContext<LocaleState>(key);
export const setLocaleState = (key = DEFAULT_LOCALE_STATE_KEY): LocaleState => {
	const ls = new LocaleStateClass();
	return setContext(key, ls);
};