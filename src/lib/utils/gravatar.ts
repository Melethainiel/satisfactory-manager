/**
 * Gravatar utility functions for generating profile image URLs
 */

/**
 * Generate SHA256 hash of a string using Web Crypto API (browser) or crypto (Node.js)
 * Following Gravatar's official documentation: https://docs.gravatar.com/rest/hash/
 */
async function generateSHA256(input: string): Promise<string> {
	// For Node.js environment (SSR), use crypto module
	if (typeof window === 'undefined') {
		try {
			const crypto = await import('crypto');
			return crypto.createHash('sha256').update(input).digest('hex');
		} catch (error) {
			console.error('Node.js SHA256 hashing failed:', error);
			throw error;
		}
	}

	// For browser environment, use Web Crypto API
	try {
		const encoder = new TextEncoder();
		const data = encoder.encode(input);
		const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	} catch (error) {
		console.error('Browser SHA256 hashing failed:', error);
		throw error;
	}
}

/**
 * Gravatar options interface
 */
export interface GravatarOptions {
	/** Size of the image in pixels (1-2048, default: 200) */
	size?: number;
	/** Default image type when no Gravatar exists */
	default?: 'mp' | 'identicon' | 'monsterid' | 'wavatar' | 'retro' | 'robohash' | 'blank' | string;
	/** Force default image even if Gravatar exists */
	forceDefault?: boolean;
	/** Rating level (g, pg, r, x) */
	rating?: 'g' | 'pg' | 'r' | 'x';
}

/**
 * Generate a Gravatar URL for an email address
 */
export async function getGravatarUrl(
	email: string | null | undefined,
	options: GravatarOptions = {}
): Promise<string> {
	// Default fallback image
	const defaultImage =
		'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=facearea&facepad=3&w=256&h=256&q=80';

	if (!email) {
		return defaultImage;
	}

	const { size = 200, default: defaultType = 'mp', forceDefault = false, rating = 'g' } = options;

	try {
		// Normalize email: lowercase and trim (as per Gravatar docs)
		const normalizedEmail = email.toLowerCase().trim();

		// Generate SHA256 hash (as per Gravatar docs)
		const hash = await generateSHA256(normalizedEmail);

		// Build Gravatar URL
		const params = new URLSearchParams({
			s: size.toString(),
			d: defaultType,
			r: rating
		});

		if (forceDefault) {
			params.set('f', 'y');
		}

		const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?${params.toString()}`;
		return gravatarUrl;
	} catch (error) {
		console.error('Error generating Gravatar URL:', error);
		return defaultImage;
	}
}

/**
 * Check if a Gravatar exists for an email address
 */
export async function hasGravatar(email: string | null | undefined): Promise<boolean> {
	if (!email) return false;

	try {
		const url = await getGravatarUrl(email, { default: '404' });
		const response = await fetch(url, { method: 'HEAD' });
		return response.ok;
	} catch (error) {
		console.error('Error checking Gravatar existence:', error);
		return false;
	}
}

/**
 * Get a Gravatar URL with fallback handling
 */
export async function getGravatarWithFallback(
	email: string | null | undefined,
	fallbackUrl: string,
	options: GravatarOptions = {}
): Promise<string> {
	try {
		// First try to get Gravatar URL
		const gravatarUrl = await getGravatarUrl(email, options);

		// If it's our default fallback, use the provided fallback instead
		if (gravatarUrl.includes('unsplash.com')) {
			return fallbackUrl;
		}

		return gravatarUrl;
	} catch (error) {
		console.error('Error getting Gravatar with fallback:', error);
		return fallbackUrl;
	}
}
