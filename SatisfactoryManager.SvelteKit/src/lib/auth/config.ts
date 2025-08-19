import type { AzureB2CConfig } from '../states/authState.svelte';
import { browser } from '$app/environment';

// Helper function to get environment variables safely
const getEnvVar = (key: string, fallback: string): string => {
	if (browser) {
		// Client-side: use Vite environment variables (must start with VITE_)
		return (import.meta.env as any)[`VITE_${key}`] || fallback;
	} else {
		// Server-side: use process.env
		return process.env[key] || fallback;
	}
};

// Azure AD B2C Configuration
// Primary custom API scope for backend authorization
export const API_USER_ACCESS_SCOPE = getEnvVar(
	'AZURE_B2C_API_USER_ACCESS_SCOPE',
	'https://SatisfactoryManager.onmicrosoft.com/71d43619-ad3d-49d4-bae9-97e38ec57dc4/access_users'
);

export const azureB2CConfig: AzureB2CConfig = {
	clientId: getEnvVar('AZURE_B2C_CLIENT_ID', '71d43619-ad3d-49d4-bae9-97e38ec57dc4'),
	authority: getEnvVar(
		'AZURE_B2C_AUTHORITY',
		'https://satisfactorymanager.b2clogin.com/SatisfactoryManager.onmicrosoft.com/B2C_1_SignInSignUp'
	),
	knownAuthorities: [getEnvVar('AZURE_B2C_KNOWN_AUTHORITY', 'satisfactorymanager.b2clogin.com')],
	redirectUri: getEnvVar(
		'AZURE_B2C_REDIRECT_URI',
		typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
	),
	postLogoutRedirectUri: getEnvVar(
		'AZURE_B2C_POST_LOGOUT_REDIRECT_URI',
		typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
	),
	// Scopes to request during initial authentication (include API scope for consent upfront)
	scopes: ['openid', 'profile', 'email', API_USER_ACCESS_SCOPE]
};
