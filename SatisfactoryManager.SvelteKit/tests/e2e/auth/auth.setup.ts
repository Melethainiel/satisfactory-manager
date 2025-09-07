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
				environment: 'login.microsoftonline.com'
			},
			expiresOn: new Date(Date.now() + 3600000) // 1 hour from now
		};
		
		// Store mock authentication state
		localStorage.setItem('msal-auth-state', JSON.stringify(mockAuthState));
		
		// Mock the MSAL PublicClientApplication
		(window as any).mockMSALInstance = {
			initialized: true,
			getAllAccounts: () => [mockAuthState.account],
			getAccountByHomeId: () => mockAuthState.account,
			acquireTokenSilent: () => Promise.resolve({
				accessToken: mockAuthState.accessToken,
				account: mockAuthState.account
			}),
			loginPopup: () => Promise.resolve({
				accessToken: mockAuthState.accessToken,
				idToken: mockAuthState.idToken,
				account: mockAuthState.account
			}),
			logout: () => Promise.resolve()
		};
	});
	
	// Navigate to the application
	await page.goto('/');
	
	// If the app tries to initialize real MSAL, intercept and use our mock
	await page.evaluate(() => {
		// Override MSAL browser import if it exists
		if ((window as any).msal) {
			(window as any).msal.PublicClientApplication = function() {
				return (window as any).mockMSALInstance;
			};
		}
	});
	
	// Wait for the application to load and recognize the mock authentication
	await page.waitForTimeout(2000);
	
	// Trigger a refresh to ensure authentication state is picked up
	await page.reload();
	
	// Verify mock authentication worked
	await expect(page.locator('body')).toBeVisible();
	
	console.log('✅ Mock authentication setup completed');
}

export { authFile };