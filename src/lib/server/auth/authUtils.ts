import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { userService } from '../services/userService';
import { gameService } from '../services/gameService';
import { siteService } from '../services/siteService';
import type { GameUserRole } from '../db/schema';

export interface AuthenticatedUser {
	id: string;
	email: string;
	displayName: string;
}

export interface AuthenticationResult {
	success: boolean;
	user?: AuthenticatedUser;
	error?: string;
}

/**
 * Extract and validate Bearer token from request headers
 */
function extractBearerToken(request: Request): string | null {
	const authHeader = request.headers.get('authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}
	return authHeader.substring(7); // Remove "Bearer " prefix
}

/**
 * Validate JWT token with Azure B2C
 * For now, this is a placeholder that extracts email from token payload
 * In a full implementation, you would verify the token signature with Azure B2C public keys
 */
async function validateJwtToken(token: string): Promise<{ email?: string; error?: string }> {
	try {
		// Basic JWT parsing (without signature verification for now)
		const parts = token.split('.');
		if (parts.length !== 3) {
			return { error: 'Invalid token format' };
		}

		// Decode payload (second part)
		const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

		// Check token expiration
		if (payload.exp && Date.now() >= payload.exp * 1000) {
			return { error: 'Token expired' };
		}

		// Extract email from token claims
		const email = payload.emails?.[0] || payload.email || payload.preferred_username;
		if (!email) {
			return { error: 'No email found in token' };
		}

		return { email };
	} catch (error) {
		console.error('Error validating JWT token:', error);
		return { error: 'Token validation failed' };
	}
}

/**
 * Authenticate user from request headers
 */
export async function authenticateUser(request: Request): Promise<AuthenticationResult> {
	// Extract Bearer token
	const token = extractBearerToken(request);
	if (!token) {
		return { success: false, error: 'No authorization token provided' };
	}

	// Validate JWT token
	const tokenValidation = await validateJwtToken(token);
	if (tokenValidation.error) {
		return { success: false, error: tokenValidation.error };
	}

	// Get user from database
	const user = await userService.getByEmail(tokenValidation.email!);
	if (!user) {
		return { success: false, error: 'User not found' };
	}

	return {
		success: true,
		user: {
			id: user.id,
			email: user.email,
			displayName: user.displayName
		}
	};
}

/**
 * Check if user has admin privileges
 * For now, this is a simple check - in a real implementation, you would check user roles
 */
export async function isUserAdmin(user: AuthenticatedUser): Promise<boolean> {
	// Placeholder: In a real implementation, check user roles/permissions
	// For now, we'll implement this as all authenticated users being admins
	// This should be replaced with proper role-based access control
	return true;
}

/**
 * Higher-order function that wraps RequestHandler with authentication
 */
export function requireAuth(
	handler: (params: { user: AuthenticatedUser; [key: string]: any }) => Promise<Response>
): RequestHandler {
	return async (event) => {
		// Authenticate user
		const authResult = await authenticateUser(event.request);
		if (!authResult.success || !authResult.user) {
			return json({ error: authResult.error || 'Authentication failed' }, { status: 401 });
		}

		// Call the original handler with authenticated user
		return handler({ ...event, user: authResult.user });
	};
}

/**
 * Higher-order function that wraps RequestHandler with admin authentication
 */
export function requireAdmin(
	handler: (params: { user: AuthenticatedUser; [key: string]: any }) => Promise<Response>
): RequestHandler {
	return async (event) => {
		// Authenticate user
		const authResult = await authenticateUser(event.request);
		if (!authResult.success || !authResult.user) {
			return json({ error: authResult.error || 'Authentication failed' }, { status: 401 });
		}

		// Check admin privileges
		const hasAdminAccess = await isUserAdmin(authResult.user);
		if (!hasAdminAccess) {
			return json({ error: 'Admin access required' }, { status: 403 });
		}

		// Call the original handler with authenticated admin user
		return handler({ ...event, user: authResult.user });
	};
}

/**
 * Utility function to validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uuid);
}

/**
 * Check if user has permission to access a site
 */
export async function canUserAccessSite(
	userId: string,
	siteId: string,
	requiredRole: GameUserRole = 'Reader'
): Promise<{ allowed: boolean; userRole?: GameUserRole; error?: string }> {
	try {
		// Validate siteId
		if (!isValidUUID(siteId)) {
			return { allowed: false, error: 'Invalid site ID format' };
		}

		// Get site to find the game
		const site = await siteService.getById(siteId);
		if (!site) {
			return { allowed: false, error: 'Site not found' };
		}

		// Check user's role in the game
		const userGameRole = await gameService.getUserDetailed(site.gameId, userId);
		if (!userGameRole) {
			return { allowed: false, error: 'User not authorized for this game' };
		}

		// Define role hierarchy
		const roleHierarchy: Record<GameUserRole, number> = {
			Reader: 1,
			Contributor: 2,
			Administrator: 3,
			Owner: 4
		};

		const userRoleLevel = roleHierarchy[userGameRole.role];
		const requiredRoleLevel = roleHierarchy[requiredRole];

		if (userRoleLevel >= requiredRoleLevel) {
			return { allowed: true, userRole: userGameRole.role };
		} else {
			return {
				allowed: false,
				userRole: userGameRole.role,
				error: `Insufficient permissions. Required: ${requiredRole}, Current: ${userGameRole.role}`
			};
		}
	} catch (error) {
		console.error('Error checking site access:', error);
		return { allowed: false, error: 'Failed to check site access' };
	}
}

/**
 * Higher-order function that wraps RequestHandler with site access authorization
 */
export function requireSiteAccess(requiredRole: GameUserRole = 'Reader', siteIdParam = 'siteId') {
	return function (
		handler: (params: { user: AuthenticatedUser; [key: string]: any }) => Promise<Response>
	): RequestHandler {
		return async (event) => {
			// Authenticate user first
			const authResult = await authenticateUser(event.request);
			if (!authResult.success || !authResult.user) {
				return json({ error: authResult.error || 'Authentication failed' }, { status: 401 });
			}

			// Get site ID from params
			const siteId = (event.params as Record<string, string>)?.[siteIdParam];
			if (!siteId) {
				return json({ error: `Missing ${siteIdParam} parameter` }, { status: 400 });
			}

			// Check site access
			const accessResult = await canUserAccessSite(authResult.user.id, siteId, requiredRole);
			if (!accessResult.allowed) {
				const statusCode = accessResult.error?.includes('not found') ? 404 : 403;
				return json({ error: accessResult.error }, { status: statusCode });
			}

			// Call the original handler with authenticated user and site access confirmation
			return handler({ ...event, user: authResult.user });
		};
	};
}
