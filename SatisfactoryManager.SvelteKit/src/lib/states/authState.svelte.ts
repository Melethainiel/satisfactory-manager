import { getContext, setContext } from 'svelte';
import { API_USER_ACCESS_SCOPE } from '$lib/auth/config';
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

// Types for Azure AD B2C configuration
export interface AzureB2CConfig {
	clientId: string;
	authority: string;
	knownAuthorities: string[];
	redirectUri?: string;
	postLogoutRedirectUri?: string;
	scopes?: string[];
}

// User information interface
export interface UserInfo {
	id?: string;
	displayName?: string;
	email?: string;
}

// Authentication state interface
export interface AuthState {
	isAuthenticated: boolean;
	isLoading: boolean;
	user: UserInfo | null;
	accessToken: string | null;
	error: string | null;
	initializeMsal: (config?: Partial<AzureB2CConfig>) => Promise<void>;
	signIn: () => Promise<void>;
	signOut: () => Promise<void>;
	getAccessToken: (scopes?: string[]) => Promise<string | null>;
	getApiAccessToken: () => Promise<string | null>;
	clearError: () => void;
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

class AuthStateClass implements AuthState {
	// Reactive state using Svelte 5 $state rune
	isAuthenticated = $state(false);
	isLoading = $state(true);
	user = $state<UserInfo | null>(null);
	accessToken = $state<string | null>(null);
	error = $state<string | null>(null);

	// MSAL instance
	private msalInstance: PublicClientApplication | null = null;
	private msalConfig: Configuration;

	constructor() {
		// MSAL Configuration
		this.msalConfig = {
			auth: {
				clientId: defaultConfig.clientId,
				authority: defaultConfig.authority,
				knownAuthorities: defaultConfig.knownAuthorities,
				redirectUri: defaultConfig.redirectUri,
				postLogoutRedirectUri: defaultConfig.postLogoutRedirectUri
			},
			cache: {
				cacheLocation: 'localStorage', // Use sessionStorage for better security
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
	}

	// Initialize MSAL instance (call this once in your app)
	initializeMsal = async (config?: Partial<AzureB2CConfig>): Promise<void> => {
		try {
			// Update config if provided
			if (config) {
				Object.assign(defaultConfig, config);
				this.msalConfig.auth.clientId = defaultConfig.clientId;
				this.msalConfig.auth.authority = defaultConfig.authority;
				this.msalConfig.auth.knownAuthorities = defaultConfig.knownAuthorities;
				this.msalConfig.auth.redirectUri = defaultConfig.redirectUri;
				this.msalConfig.auth.postLogoutRedirectUri = defaultConfig.postLogoutRedirectUri;
			}

			// Create MSAL instance
			this.msalInstance = new PublicClientApplication(this.msalConfig);

			// Initialize MSAL
			await this.msalInstance.initialize();

			// Handle redirect response
			await this.handleRedirectResponse();

			// Check if user is already authenticated
			await this.checkAuthenticationState();

			this.isLoading = false;
		} catch (error) {
			console.error('Failed to initialize MSAL:', error);
			this.isLoading = false;
			this.error = error instanceof Error ? error.message : 'Failed to initialize authentication';
		}
	};

	// Handle redirect response after login
	private handleRedirectResponse = async (): Promise<void> => {
		if (!this.msalInstance) {
			throw new Error('MSAL instance not initialized');
		}

		try {
			const response = await this.msalInstance.handleRedirectPromise();
			if (response) {
				// Successfully authenticated via redirect
				this.updateAuthState(response);
			}
		} catch (error) {
			console.error('Error handling redirect response:', error);
			this.error = error instanceof Error ? error.message : 'Authentication failed';
		}
	};

	// Check current authentication state
	private checkAuthenticationState = async (): Promise<void> => {
		if (!this.msalInstance) {
			return;
		}

		const accounts = this.msalInstance.getAllAccounts();
		if (accounts.length > 0) {
			// User is already signed in
			try {
				const silentRequest: SilentRequest = {
					scopes: defaultConfig.scopes || ['openid'],
					account: accounts[0]
				};

				const response = await this.msalInstance.acquireTokenSilent(silentRequest);
				this.updateAuthState(response);
			} catch (error) {
				if (error instanceof InteractionRequiredAuthError) {
					// Token expired or interaction required, user needs to sign in again
					console.log('Interaction required for token refresh');
				} else {
					console.error('Error acquiring token silently:', error);
				}
			}
		}
	};

	// Update authentication state with successful authentication result
	private updateAuthState = (authResult: AuthenticationResult): void => {
		const userInfo: UserInfo = {
			id: authResult.account?.localAccountId,
			displayName: authResult.account?.name,
			email: authResult.account?.idTokenClaims?.emails !== undefined ? authResult.account?.idTokenClaims?.emails[0] : undefined,
		};

		this.isAuthenticated = true;
		this.isLoading = false;
		this.user = userInfo;
		this.accessToken = authResult.accessToken || null; // May be empty string if only ID token was returned
		this.error = null;

		// Fire and forget ensure user exists in backend
		if (userInfo.email) {
			// Fire and forget ensure-user with bearer token if available
			this.getApiAccessToken()
				.then((token) => {
					return fetch('/api/auth/ensure-user', {
						method: 'POST',
						headers: {
							'content-type': 'application/json',
							...(token ? { Authorization: `Bearer ${token}` } : {})
						},
						body: JSON.stringify({ email: userInfo.email, displayName: userInfo.displayName })
					});
				})
				.catch((e) => console.warn('Failed to ensure user in DB', e));
		}
	};

	// Sign in with redirect
	signIn = async (): Promise<void> => {
		if (!this.msalInstance) {
			throw new Error('MSAL instance not initialized. Call initializeMsal() first.');
		}

		try {
			this.isLoading = true;
			this.error = null;

			const loginRequest: RedirectRequest = {
				// Ensure API scope included; if already in defaultConfig.scopes that's fine.
				scopes: (defaultConfig.scopes || ['openid']).includes(API_USER_ACCESS_SCOPE)
					? (defaultConfig.scopes as string[])
					: [...(defaultConfig.scopes || ['openid']), API_USER_ACCESS_SCOPE],
				redirectUri: defaultConfig.redirectUri
			};

			await this.msalInstance.loginRedirect(loginRequest);
		} catch (error) {
			console.error('Sign in failed:', error);
			this.isLoading = false;
			this.error = error instanceof Error ? error.message : 'Sign in failed';
		}
	};

	// Sign out
	signOut = async (): Promise<void> => {
		if (!this.msalInstance) {
			throw new Error('MSAL instance not initialized');
		}

		try {
			const accounts = this.msalInstance.getAllAccounts();
			if (accounts.length > 0) {
				const logoutRequest: EndSessionRequest = {
					account: accounts[0],
					postLogoutRedirectUri: defaultConfig.postLogoutRedirectUri
				};

				await this.msalInstance.logoutRedirect(logoutRequest);
			}

			// Clear local state
			this.isAuthenticated = false;
			this.isLoading = false;
			this.user = null;
			this.accessToken = null;
			this.error = null;
		} catch (error) {
			console.error('Sign out failed:', error);
			this.error = error instanceof Error ? error.message : 'Sign out failed';
		}
	};

	// Get access token (for API calls)
	getAccessToken = async (scopes?: string[]): Promise<string | null> => {
		if (!this.msalInstance) {
			throw new Error('MSAL instance not initialized');
		}

		try {
			const accounts = this.msalInstance.getAllAccounts();
			if (accounts.length === 0) {
				return null;
			}

			const silentRequest: SilentRequest = {
				scopes: scopes && scopes.length > 0 ? scopes : (defaultConfig.scopes || ['openid']),
				account: accounts[0]
			};

			const response = await this.msalInstance.acquireTokenSilent(silentRequest);
			// Store last acquired token if it's for API scope.
			if (response.accessToken) {
				this.accessToken = response.accessToken;
			}
			return response.accessToken;
		} catch (error) {
			if (error instanceof InteractionRequiredAuthError) {
				// Token expired, redirect to sign in
				await this.signIn();
				return null;
			}
			console.error('Error acquiring access token:', error);
			return null;
		}
	};

	// Convenience for API token using the standard user access scope
	getApiAccessToken = async (): Promise<string | null> => {
		// If we already have a non-empty token assume it's valid until MSAL tells otherwise
		if (this.accessToken) return this.accessToken;
		const token = await this.getAccessToken([API_USER_ACCESS_SCOPE]);
		this.accessToken = token; // Store the token for future use
		return token;
	};

	// Clear error state
	clearError = (): void => {
		this.error = null;
	};
}

// Context keys
const DEFAULT_AUTH_KEY = '$_auth_state';

// Context getters and setters
export const getAuthState = (key = DEFAULT_AUTH_KEY): AuthState => {
	return getContext<AuthState>(key);
};

export const setAuthState = (key = DEFAULT_AUTH_KEY): AuthState => {
	const authState = new AuthStateClass();
	return setContext(key, authState);
};
