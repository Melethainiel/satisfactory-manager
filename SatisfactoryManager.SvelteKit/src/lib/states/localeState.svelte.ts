import { getContext, setContext } from 'svelte';
import { setLocale } from '$lib/i18n';

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
			// Update the locale using svelte-i18n
			setLocale(newLocale);
			this.currentLocale = newLocale;
		} catch (error) {
			console.error('Failed to change locale:', error);
		} finally {
			this.isLoading = false;
		}
	}
}

const DEFAULT_LOCALE_STATE_KEY = '$_locale_state';

export const getLocaleState = (key = DEFAULT_LOCALE_STATE_KEY): LocaleState =>
	getContext<LocaleState>(key);
export const setLocaleState = (key = DEFAULT_LOCALE_STATE_KEY): LocaleState => {
	const ls = new LocaleStateClass();
	return setContext(key, ls);
};
