/**
 * Authentication mocks for unit and component testing
 * 
 * This file provides comprehensive mocking for Azure B2C/MSAL authentication
 * to enable isolated testing of components that depend on authentication.
 */

import { vi } from 'vitest';

// Mock account data
export const mockAccount = {
	homeAccountId: 'test-home-account-id.uuid-guid',
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
		email: 'test@example.com'
	}
};

// Mock authentication result
export const mockAuthResult = {
	accessToken: 'mock-access-token-eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9',
	idToken: 'mock-id-token-eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9',
	account: mockAccount,
	scopes: ['openid', 'profile', 'email'],
	expiresOn: new Date(Date.now() + 3600000), // 1 hour from now
	tokenType: 'Bearer' as const,
	correlationId: 'test-correlation-id'
};

// Mock MSAL PublicClientApplication
export const mockMSALInstance = {
	initialize: vi.fn().mockResolvedValue(undefined),
	
	// Authentication methods
	loginPopup: vi.fn().mockResolvedValue(mockAuthResult),
	loginRedirect: vi.fn().mockResolvedValue(undefined),
	logout: vi.fn().mockResolvedValue(undefined),
	logoutRedirect: vi.fn().mockResolvedValue(undefined),
	
	// Token methods
	acquireTokenSilent: vi.fn().mockResolvedValue(mockAuthResult),
	acquireTokenPopup: vi.fn().mockResolvedValue(mockAuthResult),
	acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
	
	// Account methods
	getAllAccounts: vi.fn().mockReturnValue([mockAccount]),
	getAccountByHomeId: vi.fn().mockReturnValue(mockAccount),
	getAccountByLocalId: vi.fn().mockReturnValue(mockAccount),
	getAccountByUsername: vi.fn().mockReturnValue(mockAccount),
	
	// Event methods
	addEventCallback: vi.fn(),
	removeEventCallback: vi.fn(),
	
	// Configuration
	getConfiguration: vi.fn().mockReturnValue({
		auth: {
			clientId: 'test-client-id',
			authority: 'https://login.microsoftonline.com/test-tenant-id'
		}
	}),
	
	// Utility methods
	setActiveAccount: vi.fn(),
	getActiveAccount: vi.fn().mockReturnValue(mockAccount),
	initializeWrapperLibrary: vi.fn(),
	setNavigationClient: vi.fn(),
	getTokenCache: vi.fn().mockReturnValue({
		loadExternalTokens: vi.fn(),
		getAccountEntity: vi.fn(),
		getAllAccountEntities: vi.fn()
	})
};

// Mock MSAL browser module
export const msalBrowserMock = {
	PublicClientApplication: vi.fn().mockImplementation(() => mockMSALInstance),
	
	// Constants
	LogLevel: {
		Error: 0,
		Warning: 1,
		Info: 2,
		Verbose: 3,
		Trace: 4
	},
	
	// Error classes
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
	
	// Interaction types
	InteractionType: {
		Redirect: 'redirect',
		Popup: 'popup',
		Silent: 'silent'
	},
	
	// Browser configuration
	BrowserCacheLocation: {
		LocalStorage: 'localStorage',
		SessionStorage: 'sessionStorage',
		MemoryStorage: 'memoryStorage'
	}
};

// Auth state mock for Svelte stores/runes
export const mockAuthState = {
	isAuthenticated: true,
	user: mockAccount,
	accessToken: mockAuthResult.accessToken,
	isLoading: false,
	error: null
};

// Helper functions for testing
export const createMockAuthState = (overrides: Partial<typeof mockAuthState> = {}) => ({
	...mockAuthState,
	...overrides
});

export const createMockAccount = (overrides: Partial<typeof mockAccount> = {}) => ({
	...mockAccount,
	...overrides
});

export const createMockAuthResult = (overrides: Partial<typeof mockAuthResult> = {}) => ({
	...mockAuthResult,
	...overrides
});

// Reset all mocks
export const resetAuthMocks = () => {
	Object.values(mockMSALInstance).forEach(mock => {
		if (vi.isMockFunction(mock)) {
			mock.mockClear();
		}
	});
};

// Set up authentication success scenario
export const setupAuthSuccess = () => {
	mockMSALInstance.getAllAccounts.mockReturnValue([mockAccount]);
	mockMSALInstance.getActiveAccount.mockReturnValue(mockAccount);
	mockMSALInstance.acquireTokenSilent.mockResolvedValue(mockAuthResult);
};

// Set up authentication failure scenario
export const setupAuthFailure = () => {
	mockMSALInstance.getAllAccounts.mockReturnValue([]);
	mockMSALInstance.getActiveAccount.mockReturnValue(null);
	mockMSALInstance.acquireTokenSilent.mockRejectedValue(
		new msalBrowserMock.InteractionRequiredAuthError()
	);
};

// Set up loading state
export const setupAuthLoading = () => {
	mockMSALInstance.initialize.mockImplementation(
		() => new Promise(resolve => setTimeout(resolve, 1000))
	);
};