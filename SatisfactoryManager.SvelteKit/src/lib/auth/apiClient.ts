import { getAccessToken } from './azureB2C';
import { browser } from '$app/environment';

// API configuration
interface ApiConfig {
	baseUrl?: string;
	defaultScopes?: string[];
}

// Environment variables for API configuration
// These should be set in your .env file with PUBLIC_ prefix for client-side access
const getApiBaseUrl = (): string => {
	if (browser) {
		// Client-side: use public environment variables
		return import.meta.env.VITE_API_BASE_URL || 'https://localhost:7001';
	} else {
		// Server-side: can access private environment variables
		return process.env.API_BASE_URL || 'https://localhost:7001';
	}
};

const defaultApiConfig: ApiConfig = {
	baseUrl: getApiBaseUrl(),
	defaultScopes: ['https://satisfactorymanager.onmicrosoft.com/api/access_as_user'] // Replace with your actual API scopes
};

// API request options
interface ApiRequestOptions extends RequestInit {
	scopes?: string[];
	skipAuth?: boolean;
}

// API response wrapper
interface ApiResponse<T = any> {
	data?: T;
	error?: string;
	status: number;
}

class ApiClient {
	private config: ApiConfig;

	constructor(config: Partial<ApiConfig> = {}) {
		this.config = { ...defaultApiConfig, ...config };
	}

	// Generic API request method
	async request<T = any>(
		endpoint: string, 
		options: ApiRequestOptions = {}
	): Promise<ApiResponse<T>> {
		const { scopes, skipAuth, ...fetchOptions } = options;

		try {
			// Prepare headers
			const headers = new Headers(fetchOptions.headers);
			
			// Set default content type if not specified
			if (!headers.has('Content-Type') && fetchOptions.body) {
				headers.set('Content-Type', 'application/json');
			}

			// Add authorization header if not skipping auth
			if (!skipAuth) {
				const accessToken = await getAccessToken(scopes || this.config.defaultScopes);
				if (accessToken) {
					headers.set('Authorization', `Bearer ${accessToken}`);
				} else {
					return {
						error: 'Unable to acquire access token',
						status: 401
					};
				}
			}

			// Construct full URL
			const url = endpoint.startsWith('http') 
				? endpoint 
				: `${this.config.baseUrl}${endpoint}`;

			// Make the request
			const response = await fetch(url, {
				...fetchOptions,
				headers
			});

			// Parse response
			let data: T | undefined;
			const contentType = response.headers.get('Content-Type');
			
			if (contentType?.includes('application/json')) {
				data = await response.json();
			} else if (contentType?.includes('text/')) {
				data = (await response.text()) as unknown as T;
			}

			// Return standardized response
			return {
				data,
				status: response.status,
				error: !response.ok ? `Request failed with status ${response.status}` : undefined
			};

		} catch (error) {
			console.error('API request failed:', error);
			return {
				error: error instanceof Error ? error.message : 'Unknown error occurred',
				status: 0
			};
		}
	}

	// Convenience methods for common HTTP verbs
	async get<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, { ...options, method: 'GET' });
	}

	async post<T = any>(endpoint: string, data?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, {
			...options,
			method: 'POST',
			body: data ? JSON.stringify(data) : undefined
		});
	}

	async put<T = any>(endpoint: string, data?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, {
			...options,
			method: 'PUT',
			body: data ? JSON.stringify(data) : undefined
		});
	}

	async patch<T = any>(endpoint: string, data?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, {
			...options,
			method: 'PATCH',
			body: data ? JSON.stringify(data) : undefined
		});
	}

	async delete<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, { ...options, method: 'DELETE' });
	}
}

// Create default API client instance
export const apiClient = new ApiClient();

// Export ApiClient class for custom instances
export { ApiClient };
export type { ApiResponse, ApiRequestOptions, ApiConfig };

// Helper function to create authenticated API client with custom config
export function createApiClient(config: Partial<ApiConfig>): ApiClient {
	return new ApiClient(config);
}
