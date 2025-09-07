/**
 * Helper for setting up mock authentication in E2E tests
 */

import { Page } from '@playwright/test';

export async function setupMockAuthForTest(page: Page) {
	// First, set up the mock MSAL instance in the page context
	await page.addInitScript(() => {
		// Re-create the mockMSALInstance for each test (similar to auth.setup.ts)
		const mockAccount = {
			homeAccountId: 'uid.utid',
			localAccountId: 'test-local-account-id',
			username: 'test@example.com',
			name: 'Test User',
			environment: 'login.microsoftonline.com',
			tenantId: 'test-tenant-id',
			idTokenClaims: {
				aud: 'test-client-id',
				iss: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
				sub: 'test-subject-id',
				name: 'Test User',
				preferred_username: 'test@example.com',
				email: 'test@example.com',
				emails: ['test@example.com']
			}
		};

		const mockAuthResult = {
			accessToken: 'mock-access-token-for-test',
			idToken: 'mock-id-token-for-test',
			account: mockAccount,
			scopes: ['openid', 'profile', 'email', 'https://SatisfactoryManager.onmicrosoft.com/71d43619-ad3d-49d4-bae9-97e38ec57dc4/access_users'],
			expiresOn: new Date(Date.now() + 3600000),
			tokenType: 'Bearer',
			correlationId: 'test-correlation-id'
		};

		// Mock the complete MSAL PublicClientApplication with realistic behavior
		const mockMSALInstance = {
			initialize: () => {
				console.log('🔧 Test Mock MSAL initialize called');
				return Promise.resolve();
			},
			handleRedirectPromise: () => Promise.resolve(null),
			initialized: true,
			getAllAccounts: () => {
				console.log('🔧 Test Mock getAllAccounts called, returning:', [mockAccount]);
				return [mockAccount];
			},
			getAccountByHomeId: (homeId: string) => {
				console.log('🔧 Test Mock getAccountByHomeId called with:', homeId);
				return homeId === mockAccount.homeAccountId ? mockAccount : null;
			},
			getAccountByLocalId: (localId: string) => localId === mockAccount.localAccountId ? mockAccount : null,
			getAccountByUsername: (username: string) => username === mockAccount.username ? mockAccount : null,
			getActiveAccount: () => {
				console.log('🔧 Test Mock getActiveAccount called, returning:', mockAccount);
				return mockAccount;
			},
			setActiveAccount: (account: any) => {
				console.log('🔧 Test Mock setActiveAccount called with:', account);
			},
			acquireTokenSilent: (request: any) => {
				console.log('🔧 Test Mock acquireTokenSilent called with:', request);
				return Promise.resolve(mockAuthResult);
			},
			acquireTokenPopup: (request: any) => Promise.resolve(mockAuthResult),
			acquireTokenRedirect: (request: any) => Promise.resolve(),
			loginPopup: (request: any) => Promise.resolve(mockAuthResult),
			loginRedirect: (request: any) => Promise.resolve(),
			logout: (request: any) => Promise.resolve(),
			logoutRedirect: (request: any) => Promise.resolve(),
			logoutPopup: (request: any) => Promise.resolve(),
			addEventCallback: () => {},
			removeEventCallback: () => {},
			getConfiguration: () => ({
				auth: {
					clientId: 'test-client-id',
					authority: `https://login.microsoftonline.com/${mockAccount.tenantId}`
				}
			}),
			getTokenCache: () => ({
				loadExternalTokens: () => {},
				getAccountEntity: () => mockAccount,
				getAllAccountEntities: () => [mockAccount]
			})
		};

		(window as any).mockMSALInstance = mockMSALInstance;
		console.log('🔧 Test Mock MSAL instance created');
	});

	// Mock API endpoints that require authentication
	await page.route('**/api/auth/**', route => {
		console.log('🔧 Test API auth route intercepted:', route.request().url());
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ 
				success: true,
				user: {
					id: 'test-user-id',
					displayName: 'Test User',
					email: 'test@example.com'
				}
			})
		});
	});

	// Mock user info endpoint
	await page.route('**/api/users/me', route => {
		console.log('🔧 Test user info route intercepted:', route.request().url());
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ 
				id: 'test-user-id',
				displayName: 'Test User',
				email: 'test@example.com'
			})
		});
	});

	// Set up route interception to mock MSAL module loading (same as in auth.setup.ts)
	await page.route('**/*@azure*msal*', route => {
		console.log('🔧 Test route intercepted for MSAL:', route.request().url());
		const mockModuleCode = `
			window.__MSAL_INTERCEPTED__ = true;
			console.log('🔧 MSAL module code executing in test...');
			
			export class PublicClientApplication {
				constructor(config) {
					console.log('🔧 Test Mock PublicClientApplication constructed via route with config:', config);
					// Return our pre-configured mock instance
					const mockInstance = window.mockMSALInstance;
					
					if (!mockInstance) {
						console.error('🔧 mockMSALInstance not found in window!');
						return {};
					}
					
					// Copy all properties to this instance
					Object.keys(mockInstance).forEach(key => {
						this[key] = mockInstance[key];
					});
					
					// Override configuration
					this.getConfiguration = () => config || {
						auth: {
							clientId: 'test-client-id',
							authority: 'https://login.microsoftonline.com/test-tenant-id'
						}
					};
					
					return this;
				}
			}
			export class InteractionRequiredAuthError extends Error {
				constructor(message = 'Interaction required') {
					super(message);
					this.name = 'InteractionRequiredAuthError';
				}
			}
			export class BrowserAuthError extends Error {
				constructor(message = 'Browser auth error') {
					super(message);
					this.name = 'BrowserAuthError';
				}
			}
			export const LogLevel = { Error: 0, Warning: 1, Info: 2, Verbose: 3, Trace: 4 };
			export const InteractionType = { Redirect: 'redirect', Popup: 'popup', Silent: 'silent' };
			export const BrowserCacheLocation = { LocalStorage: 'localStorage', SessionStorage: 'sessionStorage', MemoryStorage: 'memoryStorage' };
		`;
		route.fulfill({
			status: 200,
			contentType: 'application/javascript',
			body: mockModuleCode
		});
	});

	// Also intercept any node_modules requests
	await page.route('**/node_modules/@azure/msal-browser/**', route => {
		console.log('🔧 Test Node modules route intercepted for MSAL:', route.request().url());
		const mockModuleCode = `
			export class PublicClientApplication {
				constructor(config) {
					console.log('🔧 Test Node modules Mock PublicClientApplication constructed');
					return window.mockMSALInstance || {};
				}
			}
			export class InteractionRequiredAuthError extends Error {
				constructor(message = 'Interaction required') {
					super(message);
					this.name = 'InteractionRequiredAuthError';
				}
			}
			export const LogLevel = { Error: 0, Warning: 1, Info: 2, Verbose: 3 };
		`;
		route.fulfill({
			status: 200,
			contentType: 'application/javascript',
			body: mockModuleCode
		});
	});

	console.log('🔧 Mock auth route interception set up for test');
}