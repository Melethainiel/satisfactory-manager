import { browser } from '$app/environment';
import '$lib/i18n'; // Initialize
import { locale, waitLocale } from 'svelte-i18n';
import { detectBrowserLocale, getSavedLocale } from '$lib/i18n';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async () => {
	if (browser) {
		// Use saved preference or detect browser locale
		const savedLocale = getSavedLocale();
		const browserLocale = detectBrowserLocale();
		const preferredLocale = savedLocale || browserLocale;

		locale.set(preferredLocale);
	}
	await waitLocale();
};
