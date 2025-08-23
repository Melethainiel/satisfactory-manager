import { testUsers } from './fixtures';

/**
 * Create a mock JWT token for testing
 * This creates a simple JWT-like token without signature validation
 */
export function createMockJWT(email: string, displayName: string): string {
	const header = {
		typ: 'JWT',
		alg: 'RS256'
	};

	const payload = {
		emails: [email],
		email: email,
		name: displayName,
		exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
		iat: Math.floor(Date.now() / 1000),
		iss: 'https://satisfactorymanager.b2clogin.com/satisfactorymanager.onmicrosoft.com/v2.0/',
		aud: '71d43619-ad3d-49d4-bae9-97e38ec57dc4'
	};

	// Create base64-encoded parts (without proper signing for tests)
	const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
	const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
	const signature = 'mock_signature_for_testing';

	return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Create authorization headers with mock JWT token
 */
export function createAuthHeaders(email?: string, displayName?: string): HeadersInit {
	const testUser = testUsers[0]; // Use first test user as default
	const userEmail = email || testUser.email;
	const userName = displayName || testUser.displayName;

	const token = createMockJWT(userEmail, userName);

	return {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json'
	};
}

/**
 * Create an expired JWT token for testing
 */
export function createExpiredMockJWT(email: string, displayName: string): string {
	const header = {
		typ: 'JWT',
		alg: 'RS256'
	};

	const payload = {
		emails: [email],
		email: email,
		name: displayName,
		exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
		iat: Math.floor(Date.now() / 1000) - 7200, // Issued 2 hours ago
		iss: 'https://satisfactorymanager.b2clogin.com/satisfactorymanager.onmicrosoft.com/v2.0/',
		aud: '71d43619-ad3d-49d4-bae9-97e38ec57dc4'
	};

	const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
	const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
	const signature = 'mock_signature_for_testing';

	return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Create authorization headers with expired JWT token
 */
export function createExpiredAuthHeaders(email?: string, displayName?: string): HeadersInit {
	const testUser = testUsers[0];
	const userEmail = email || testUser.email;
	const userName = displayName || testUser.displayName;

	const token = createExpiredMockJWT(userEmail, userName);

	return {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json'
	};
}
