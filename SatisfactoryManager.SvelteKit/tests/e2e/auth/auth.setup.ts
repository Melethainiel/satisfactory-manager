import { test as setup, expect } from '@playwright/test';
import { loadEnv } from 'vite';

/**
 * Authentication setup for E2E tests
 * 
 * This setup file handles authentication for E2E tests by either:
 * 1. Using a test Azure B2C tenant for real authentication flow testing
 * 2. Using mocked authentication for isolated testing
 */

const env = loadEnv('test', process.cwd(), '');

// File to store authenticated state
const authFile = './tests/e2e/auth/user.json';

setup('authenticate', async ({ page }) => {
	console.log('🔐 Setting up authentication for E2E tests...');
	
	// Check if we should use real Azure B2C or mock authentication
	const useRealAuth = env.TEST_USE_REAL_AZURE_B2C === 'true';
	
	if (useRealAuth) {
		// Real authentication flow using test Azure B2C tenant
		await setupRealAuthentication(page);
	} else {
		// Mock authentication for isolated testing
		await setupMockAuthentication(page);
	}
	
	// Save authentication state
	await page.context().storageState({ path: authFile });
	console.log('✅ Authentication setup completed');
});

async function setupRealAuthentication(page: any) {
	console.log('🌐 Using real Azure B2C authentication...');
	
	// Navigate to the application
	await page.goto('/');
	
	// Wait for the login button to appear
	await expect(page.locator('text=Sign In')).toBeVisible({ timeout: 10000 });
	
	// Click the login button to start Azure B2C flow
	await page.click('text=Sign In');
	
	// Wait for Azure B2C login page
	await page.waitForURL('**/login**', { timeout: 30000 });
	
	// Fill in test credentials
	const testEmail = env.TEST_USER_EMAIL;
	const testPassword = env.TEST_USER_PASSWORD;
	
	if (!testEmail || !testPassword) {
		throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set for real authentication');
	}
	
	// Fill email and password
	await page.fill('input[type="email"], input[name="loginfmt"]', testEmail);
	await page.click('input[type="submit"], button[type="submit"]');
	
	// Wait for password field and fill it
	await page.fill('input[type="password"], input[name="passwd"]', testPassword);
	await page.click('input[type="submit"], button[type="submit"]');
	
	// Wait for redirect back to application
	await page.waitForURL('**/', { timeout: 30000 });
	
	// Verify we're logged in by checking for user info or logout button
	await expect(page.locator('text=Sign Out, text=Profile, text=Dashboard')).toBeVisible({ timeout: 10000 });
}

async function setupMockAuthentication(page: any) {
	console.log('🎭 Using mock authentication...');
	
	// Create comprehensive mock that fully replaces MSAL
	await page.addInitScript(() => {
		// Mock account data that matches MSAL format exactly
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
		
		// Mock authentication result
		const mockAuthResult = {
			accessToken: 'mock-access-token-eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXN1YmplY3QtaWQiLCJuYW1lIjoiVGVzdCBVc2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0',
			idToken: 'mock-id-token-eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9',
			account: mockAccount,
			scopes: ['openid', 'profile', 'email', 'https://SatisfactoryManager.onmicrosoft.com/71d43619-ad3d-49d4-bae9-97e38ec57dc4/access_users'],
			expiresOn: new Date(Date.now() + 3600000),
			tokenType: 'Bearer',
			correlationId: 'test-correlation-id'
		};
		
		// Use a more realistic client ID that matches what the app expects
		// Check if there are any environment variables we should use
		const clientId = window.location.hostname === 'localhost' ? 'test-client-id' : 'test-client-id';
		
		// Set up complete MSAL localStorage state with a dynamic client ID
		const msalTokenKey = `msal.${clientId}.AccessToken.${mockAccount.tenantId}.${mockAccount.homeAccountId}.https://SatisfactoryManager.onmicrosoft.com/71d43619-ad3d-49d4-bae9-97e38ec57dc4/access_users`;
		const msalAccountKey = `msal.${clientId}.Account.${mockAccount.tenantId}.${mockAccount.homeAccountId}`;
		
		localStorage.setItem(msalTokenKey, JSON.stringify({
			credentialType: 'AccessToken',
			homeAccountId: mockAccount.homeAccountId,
			environment: mockAccount.environment,
			clientId: clientId,
			secret: mockAuthResult.accessToken,
			target: mockAuthResult.scopes.join(' '),
			cachedAt: Math.floor(Date.now() / 1000).toString(),
			expiresOn: Math.floor(mockAuthResult.expiresOn.getTime() / 1000).toString(),
			extendedExpiresOn: Math.floor((mockAuthResult.expiresOn.getTime() + 3600000) / 1000).toString(),
			tokenType: 'Bearer'
		}));
		
		localStorage.setItem(msalAccountKey, JSON.stringify({
			homeAccountId: mockAccount.homeAccountId,
			environment: mockAccount.environment,
			realm: mockAccount.tenantId,
			localAccountId: mockAccount.localAccountId,
			username: mockAccount.username,
			authorityType: 'MSSTS',
			name: mockAccount.name,
			clientInfo: 'eyJ1aWQiOiJ0ZXN0LXVpZCIsInV0aWQiOiJ0ZXN0LXV0aWQifQ==',
			idTokenClaims: mockAccount.idTokenClaims
		}));
		
		// Store the active account identifier
		localStorage.setItem(`msal.${clientId}.active-account`, mockAccount.homeAccountId);
		
		// Also set up some additional MSAL metadata that might be needed
		localStorage.setItem('msal.version', '4.19.0');
		
		// Store any additional client info or configuration
		localStorage.setItem(`msal.${clientId}.client.info`, JSON.stringify({
			uid: 'test-uid',
			utid: 'utid'
		}));
		
		// Mock the complete MSAL PublicClientApplication with realistic behavior
		const mockMSALInstance = {
			initialize: () => {
				console.log('🔧 Mock MSAL initialize called');
				return Promise.resolve();
			},
			handleRedirectPromise: () => Promise.resolve(null),
			initialized: true,
			getAllAccounts: () => {
				console.log('🔧 Mock getAllAccounts called, returning:', [mockAccount]);
				return [mockAccount];
			},
			getAccountByHomeId: (homeId: string) => {
				console.log('🔧 Mock getAccountByHomeId called with:', homeId);
				return homeId === mockAccount.homeAccountId ? mockAccount : null;
			},
			getAccountByLocalId: (localId: string) => localId === mockAccount.localAccountId ? mockAccount : null,
			getAccountByUsername: (username: string) => username === mockAccount.username ? mockAccount : null,
			getActiveAccount: () => {
				console.log('🔧 Mock getActiveAccount called, returning:', mockAccount);
				return mockAccount;
			},
			setActiveAccount: (account: any) => {
				console.log('🔧 Mock setActiveAccount called with:', account);
			},
			acquireTokenSilent: (request: any) => {
				console.log('🔧 Mock acquireTokenSilent called with:', request);
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
					clientId: clientId,
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
	
		
		// Create complete MSAL mock module for ES imports
		const mockMSAL = {
			PublicClientApplication: class {
				constructor(config: any) {
					console.log('🔧 Mock PublicClientApplication constructed with config:', config);
					// Copy all methods from mockMSALInstance to this instance
					Object.keys(mockMSALInstance).forEach(key => {
						(this as any)[key] = (mockMSALInstance as any)[key];
					});
					// Update the configuration to match what was passed in
					if (config && config.auth) {
						const updatedInstance = { ...mockMSALInstance };
						updatedInstance.getConfiguration = () => ({
							auth: config.auth
						});
						Object.keys(updatedInstance).forEach(key => {
							(this as any)[key] = (updatedInstance as any)[key];
						});
					}
				}
			},
			InteractionRequiredAuthError: class extends Error {
				constructor(message = 'Interaction required') {
					super(message);
					this.name = 'InteractionRequiredAuthError';
				}
			},
			BrowserAuthError: class extends Error {
				constructor(message = 'Browser auth error') {
					super(message);
					this.name = 'BrowserAuthError';
				}
			},
			LogLevel: { Error: 0, Warning: 1, Info: 2, Verbose: 3, Trace: 4 },
			InteractionType: { Redirect: 'redirect', Popup: 'popup', Silent: 'silent' },
			BrowserCacheLocation: { LocalStorage: 'localStorage', SessionStorage: 'sessionStorage', MemoryStorage: 'memoryStorage' }
		};
		
		// Strategy: Intercept ES6 module loading by overriding the import function
		// This works with Vite's module system
		
		// Store the mock globally so it can be accessed anywhere
		(window as any).__MSAL_MOCK__ = mockMSAL;
		
		// Override the global module resolution
		const originalModules = (window as any).__vite_modules;
		(window as any).__vite_modules = new Proxy(originalModules || {}, {
			get(target, prop) {
				if (prop === '@azure/msal-browser') {
					console.log('🔧 Vite module proxy intercepted MSAL import');
					return mockMSAL;
				}
				return target[prop];
			}
		});
		
		// Also hook into ES6 import() calls
		if (typeof (window as any).__import__ === 'function') {
			const originalImport = (window as any).__import__;
			(window as any).__import__ = function(specifier: string) {
				if (specifier === '@azure/msal-browser' || specifier.includes('msal-browser')) {
					console.log('🔧 __import__ intercepted for MSAL:', specifier);
					return Promise.resolve(mockMSAL);
				}
				return originalImport(specifier);
			};
		}
		
		// Handle fetch-based imports (for bundlers that load modules via fetch)
		const originalFetch = window.fetch;
		window.fetch = function(input, init) {
			if (typeof input === 'string' && input.includes('@azure/msal-browser')) {
				console.log('🔧 Fetch intercepted for MSAL module:', input);
				// Return a fake ES module response
				const moduleCode = `
					export const PublicClientApplication = window.__MSAL_MOCK__.PublicClientApplication;
					export const InteractionRequiredAuthError = window.__MSAL_MOCK__.InteractionRequiredAuthError;
					export const BrowserAuthError = window.__MSAL_MOCK__.BrowserAuthError;
					export const LogLevel = window.__MSAL_MOCK__.LogLevel;
					export const InteractionType = window.__MSAL_MOCK__.InteractionType;
					export const BrowserCacheLocation = window.__MSAL_MOCK__.BrowserCacheLocation;
				`;
				return Promise.resolve(new Response(moduleCode, {
					status: 200,
					headers: { 
						'Content-Type': 'application/javascript',
						'Access-Control-Allow-Origin': '*'
					}
				}));
			}
			return originalFetch.call(this, input, init);
		};
	});
	
	// Set up route interception to mock MSAL module loading
	await page.route('**/*@azure*msal*', route => {
		console.log('🔧 Route intercepted for MSAL:', route.request().url());
		const mockModuleCode = `
			window.__MSAL_INTERCEPTED__ = true;
			console.log('🔧 MSAL module code executing...');
			
			export class PublicClientApplication {
				constructor(config) {
					console.log('🔧 Mock PublicClientApplication constructed via route with config:', config);
					// Return our pre-configured mock instance
					const mockInstance = window.mockMSALInstance;
					
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
		console.log('🔧 Node modules route intercepted for MSAL:', route.request().url());
		const mockModuleCode = `
			export class PublicClientApplication {
				constructor(config) {
					console.log('🔧 Node modules Mock PublicClientApplication constructed');
					return window.mockMSALInstance;
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
	
	// Navigate to the application
	await page.goto('/');
	
	// Wait for the page to load (don't wait for networkidle as our mock might cause issues)
	await page.waitForLoadState('domcontentloaded');
	await page.waitForTimeout(5000); // Give time for MSAL to initialize
	
	// Force evaluation of our mock setup
	await page.evaluate(() => {
		console.log('🔧 Evaluating authentication state...');
		console.log('mockMSALInstance available:', !!window.mockMSALInstance);
		console.log('localStorage keys:', Object.keys(localStorage));
	});
	
	// Check if authentication worked by looking for the user menu
	const userMenuVisible = await page.locator('[data-testid="user-menu"]').isVisible();
	if (userMenuVisible) {
		console.log('✅ Mock authentication successful - user menu visible');
	} else {
		console.log('⚠️ Mock authentication may not be working - user menu not visible');
		// Try to debug what's on the page
		const hasLoginButton = await page.locator('button:has-text("Sign In")').isVisible();
		console.log('Has login button:', hasLoginButton);
		
		// Let's also check what MSAL thinks
		const msalState = await page.evaluate(() => {
			try {
				const accounts = window.mockMSALInstance?.getAllAccounts?.() || [];
				return {
					hasAccounts: accounts.length > 0,
					accounts: accounts,
					localStorageKeys: Object.keys(localStorage).filter(k => k.includes('msal'))
				};
			} catch (e) {
				return { error: e.message };
			}
		});
		console.log('MSAL debug state:', msalState);
	}
	
	console.log('✅ Mock authentication setup completed');
}

export { authFile };