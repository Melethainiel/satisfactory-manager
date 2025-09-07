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
	
	// Mock the MSAL authentication in the browser context
	await page.addInitScript(() => {
		// Mock localStorage with authentication state
		const mockAuthState = {
			accessToken: 'mock-access-token-for-testing',
			idToken: 'mock-id-token-for-testing',
			account: {
				homeAccountId: 'test-home-account-id',
				localAccountId: 'test-local-account-id',
				username: 'test@example.com',
				name: 'Test User',
				displayName: 'Test User',
				environment: 'login.microsoftonline.com',
				idTokenClaims: {
					name: 'Test User',
					preferred_username: 'test@example.com',
					email: 'test@example.com'
				}
			},
			expiresOn: new Date(Date.now() + 3600000) // 1 hour from now
		};
		
		// Store mock authentication state in localStorage (MSAL format)
		localStorage.setItem('msal.token.keys.b2c-auth-test', JSON.stringify({
			credentialType: 'AccessToken',
			clientId: 'test-client-id'
		}));
		
		// Mock the MSAL PublicClientApplication with more complete interface
		(window as any).mockMSALInstance = {
			initialize: () => Promise.resolve(),
			initialized: true,
			getAllAccounts: () => [mockAuthState.account],
			getAccountByHomeId: () => mockAuthState.account,
			getActiveAccount: () => mockAuthState.account,
			setActiveAccount: () => {},
			acquireTokenSilent: () => Promise.resolve({
				accessToken: mockAuthState.accessToken,
				account: mockAuthState.account,
				expiresOn: mockAuthState.expiresOn,
				scopes: ['openid', 'profile', 'email']
			}),
			loginPopup: () => Promise.resolve({
				accessToken: mockAuthState.accessToken,
				idToken: mockAuthState.idToken,
				account: mockAuthState.account
			}),
			logout: () => Promise.resolve(),
			addEventCallback: () => {},
			removeEventCallback: () => {}
		};
	});
	
	// First set up global mocks before navigating
	await page.addInitScript(() => {
		// Mock @azure/msal-browser module
		const mockMSAL = {
			PublicClientApplication: class {
				constructor() {
					return (window as any).mockMSALInstance;
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
			LogLevel: { Error: 0, Warning: 1, Info: 2, Verbose: 3 },
			InteractionType: { Redirect: 'redirect', Popup: 'popup', Silent: 'silent' }
		};
		
		// Make module available globally for ES module imports
		(window as any)['@azure/msal-browser'] = mockMSAL;
		
		// Mock the dynamic import for vite/rollup
		if (!window.__vite_plugin_react_preamble_installed__) {
			const originalImport = (window as any).__import__ || ((window as any).import);
			(window as any).__import__ = (specifier: string) => {
				if (specifier === '@azure/msal-browser' || specifier.includes('@azure/msal-browser')) {
					return Promise.resolve(mockMSAL);
				}
				return originalImport ? originalImport(specifier) : Promise.reject(new Error(`Unknown module: ${specifier}`));
			};
		}
	});
	
	// Navigate to the application
	await page.goto('/');
	
	// Wait for the app to finish loading and MSAL to initialize
	await page.waitForTimeout(3000);
	
	// Verify we can see the page loaded
	await expect(page.locator('body')).toBeVisible();
	
	console.log('✅ Mock authentication setup completed');
}

export { authFile };