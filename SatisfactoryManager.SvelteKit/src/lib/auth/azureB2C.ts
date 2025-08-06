import {
	PublicClientApplication,
	type Configuration,
	type AuthenticationResult,
	type RedirectRequest,
	type SilentRequest,
	type EndSessionRequest,
	LogLevel,
	BrowserAuthError,
	InteractionRequiredAuthError
} from '@azure/msal-browser';
import { writable, type Writable } from 'svelte/store';

// Types for Azure AD B2C configuration
export interface AzureB2CConfig {
	clientId: string;
	authority: string;
	knownAuthorities: string[];
	redirectUri?: string;
	postLogoutRedirectUri?: string;
	scopes?: string[];
}

// Default configuration - replace with your actual Azure AD B2C values
const defaultConfig: AzureB2CConfig = {
	clientId: 'YOUR_CLIENT_ID', // Replace with your Application (client) ID
	authority: 'https://YOUR_TENANT.b2clogin.com/YOUR_TENANT.onmicrosoft.com/B2C_1_SIGNIN_SIGNUP', // Replace with your authority
	knownAuthorities: ['YOUR_TENANT.b2clogin.com'], // Replace with your tenant
	redirectUri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
	postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
	scopes: ['openid', 'profile', 'email']
};

// MSAL Configuration
const msalConfig: Configuration = {
	auth: {
		clientId: defaultConfig.clientId,
		authority: defaultConfig.authority,
		knownAuthorities: defaultConfig.knownAuthorities,
		redirectUri: defaultConfig.redirectUri,
		postLogoutRedirectUri: defaultConfig.postLogoutRedirectUri
	},
	cache: {
		cacheLocation: 'sessionStorage', // Use sessionStorage for better security
		storeAuthStateInCookie: false // Set to true if you have issues on IE11 or Edge
	},
	system: {
		loggerOptions: {
			loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
				if (containsPii) {
					return;
				}
				switch (level) {
					case LogLevel.Error:
						console.error(message);
						return;
					case LogLevel.Info:
						console.info(message);
						return;
					case LogLevel.Verbose:
						console.debug(message);
						return;
					case LogLevel.Warning:
						console.warn(message);
						return;
				}
			},
			logLevel: LogLevel.Warning
		}
	}
};

// ID Token Claims interface for Azure B2C
interface B2CIdTokenClaims {
	given_name?: string;
	family_name?: string;
	jobTitle?: string;
	[key: string]: any;
}

// User information interface
export interface UserInfo {
	id?: string;
	displayName?: string;
	email?: string;
	givenName?: string;
	surname?: string;
	jobTitle?: string;
	preferredUsername?: string;
}

// Authentication state interface
export interface AuthState {
	isAuthenticated: boolean;
	isLoading: boolean;
	user: UserInfo | null;
	accessToken: string | null;
	error: string | null;
}

// Initial authentication state
const initialAuthState: AuthState = {
	isAuthenticated: false,
	isLoading: true,
	user: null,
	accessToken: null,
	error: null
};

// Create MSAL instance
let msalInstance: PublicClientApplication | null = null;

// Svelte stores for reactive authentication state
export const authState: Writable<AuthState> = writable(initialAuthState);

// Initialize MSAL instance (call this once in your app)
export async function initializeMsal(config?: Partial<AzureB2CConfig>): Promise<void> {
	try {
		// Update config if provided
		if (config) {
			Object.assign(defaultConfig, config);
			msalConfig.auth.clientId = defaultConfig.clientId;
			msalConfig.auth.authority = defaultConfig.authority;
			msalConfig.auth.knownAuthorities = defaultConfig.knownAuthorities;
			msalConfig.auth.redirectUri = defaultConfig.redirectUri;
			msalConfig.auth.postLogoutRedirectUri = defaultConfig.postLogoutRedirectUri;
		}

		// Create MSAL instance
		msalInstance = new PublicClientApplication(msalConfig);

		// Initialize MSAL
		await msalInstance.initialize();

		// Handle redirect response
		await handleRedirectResponse();

		// Check if user is already authenticated
		await checkAuthenticationState();

		authState.update(state => ({
			...state,
			isLoading: false
		}));
	} catch (error) {
		console.error('Failed to initialize MSAL:', error);
		authState.update(state => ({
			...state,
			isLoading: false,
			error: error instanceof Error ? error.message : 'Failed to initialize authentication'
		}));
	}
}

// Handle redirect response after login
async function handleRedirectResponse(): Promise<void> {
	if (!msalInstance) {
		throw new Error('MSAL instance not initialized');
	}

	try {
		const response = await msalInstance.handleRedirectPromise();
		if (response) {
			// Successfully authenticated via redirect
			updateAuthState(response);
		}
	} catch (error) {
		console.error('Error handling redirect response:', error);
		authState.update(state => ({
			...state,
			error: error instanceof Error ? error.message : 'Authentication failed'
		}));
	}
}

// Check current authentication state
async function checkAuthenticationState(): Promise<void> {
	if (!msalInstance) {
		return;
	}

	const accounts = msalInstance.getAllAccounts();
	if (accounts.length > 0) {
		// User is already signed in
		try {
			const silentRequest: SilentRequest = {
				scopes: defaultConfig.scopes || ['openid'],
				account: accounts[0]
			};

			const response = await msalInstance.acquireTokenSilent(silentRequest);
			updateAuthState(response);
		} catch (error) {
			if (error instanceof InteractionRequiredAuthError) {
				// Token expired or interaction required, user needs to sign in again
				console.log('Interaction required for token refresh');
			} else {
				console.error('Error acquiring token silently:', error);
			}
		}
	}
}

// Update authentication state with successful authentication result
function updateAuthState(authResult: AuthenticationResult): void {
	const claims = authResult.idTokenClaims as B2CIdTokenClaims;
	
	const userInfo: UserInfo = {
		id: authResult.account?.localAccountId,
		displayName: authResult.account?.name,
		email: authResult.account?.username,
		givenName: claims?.given_name,
		surname: claims?.family_name,
		jobTitle: claims?.jobTitle,
		preferredUsername: authResult.account?.username
	};

	authState.update(() => ({
		isAuthenticated: true,
		isLoading: false,
		user: userInfo,
		accessToken: authResult.accessToken,
		error: null
	}));
}

// Sign in with redirect
export async function signIn(): Promise<void> {
	if (!msalInstance) {
		throw new Error('MSAL instance not initialized. Call initializeMsal() first.');
	}

	try {
		authState.update(state => ({
			...state,
			isLoading: true,
			error: null
		}));

		const loginRequest: RedirectRequest = {
			scopes: defaultConfig.scopes || ['openid'],
			redirectUri: defaultConfig.redirectUri
		};

		await msalInstance.loginRedirect(loginRequest);
	} catch (error) {
		console.error('Sign in failed:', error);
		authState.update(state => ({
			...state,
			isLoading: false,
			error: error instanceof Error ? error.message : 'Sign in failed'
		}));
	}
}

// Sign out
export async function signOut(): Promise<void> {
	if (!msalInstance) {
		throw new Error('MSAL instance not initialized');
	}

	try {
		const accounts = msalInstance.getAllAccounts();
		if (accounts.length > 0) {
			const logoutRequest: EndSessionRequest = {
				account: accounts[0],
				postLogoutRedirectUri: defaultConfig.postLogoutRedirectUri
			};

			await msalInstance.logoutRedirect(logoutRequest);
		}

		// Clear local state
		authState.update(() => ({
			isAuthenticated: false,
			isLoading: false,
			user: null,
			accessToken: null,
			error: null
		}));
	} catch (error) {
		console.error('Sign out failed:', error);
		authState.update(state => ({
			...state,
			error: error instanceof Error ? error.message : 'Sign out failed'
		}));
	}
}

// Get access token (for API calls)
export async function getAccessToken(scopes?: string[]): Promise<string | null> {
	if (!msalInstance) {
		throw new Error('MSAL instance not initialized');
	}

	try {
		const accounts = msalInstance.getAllAccounts();
		if (accounts.length === 0) {
			return null;
		}

		const silentRequest: SilentRequest = {
			scopes: scopes || defaultConfig.scopes || ['openid'],
			account: accounts[0]
		};

		const response = await msalInstance.acquireTokenSilent(silentRequest);
		return response.accessToken;
	} catch (error) {
		if (error instanceof InteractionRequiredAuthError) {
			// Token expired, redirect to sign in
			await signIn();
			return null;
		}
		console.error('Error acquiring access token:', error);
		return null;
	}
}

// Check if user is authenticated (reactive)
export function isAuthenticated(): boolean {
	let authenticated = false;
	authState.subscribe(state => {
		authenticated = state.isAuthenticated;
	})();
	return authenticated;
}

// Get current user info (reactive)
export function getCurrentUser(): UserInfo | null {
	let user: UserInfo | null = null;
	authState.subscribe(state => {
		user = state.user;
	})();
	return user;
}

// Clear error state
export function clearError(): void {
	authState.update(state => ({
		...state,
		error: null
	}));
}

// Check if authentication is in progress
export function isLoading(): boolean {
	let loading = false;
	authState.subscribe(state => {
		loading = state.isLoading;
	})();
	return loading;
}
