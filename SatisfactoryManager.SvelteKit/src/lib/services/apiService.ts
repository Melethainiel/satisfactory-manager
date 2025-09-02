import { notificationService } from './notificationService.svelte';

type AuthFetchFn = <T = any>(
	input: string | URL | Request,
	init?: RequestInit & { autoJson?: boolean }
) => Promise<T | Response>;

export interface ApiRequestOptions extends RequestInit {
	showErrorNotification?: boolean;
	autoJson?: boolean;
}

export interface ApiService {
	setApiFetch(apiFetch: AuthFetchFn): void;
	get<T = any>(url: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T>;
	post<T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method'>): Promise<T>;
	put<T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method'>): Promise<T>;
	patch<T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method'>): Promise<T>;
	delete<T = any>(url: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<T>;
	fetch<T = any>(url: string, options?: ApiRequestOptions): Promise<T>;
}

class ApiServiceClass implements ApiService {
	private apiFetch: AuthFetchFn | null = null;

	setApiFetch(apiFetch: AuthFetchFn) {
		this.apiFetch = apiFetch;
	}

	private ensureApiFetch(): AuthFetchFn {
		if (!this.apiFetch) {
			throw new Error('API service not initialized. Call setApiFetch() first.');
		}
		return this.apiFetch;
	}

	async get<T = any>(
		url: string,
		options: Omit<ApiRequestOptions, 'method' | 'body'> = {}
	): Promise<T> {
		return this.fetch<T>(url, { ...options, method: 'GET' });
	}

	async post<T = any>(
		url: string,
		data?: any,
		options: Omit<ApiRequestOptions, 'method'> = {}
	): Promise<T> {
		return this.fetch<T>(url, {
			...options,
			method: 'POST',
			body: data ? JSON.stringify(data) : undefined,
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			}
		});
	}

	async put<T = any>(
		url: string,
		data?: any,
		options: Omit<ApiRequestOptions, 'method'> = {}
	): Promise<T> {
		return this.fetch<T>(url, {
			...options,
			method: 'PUT',
			body: data ? JSON.stringify(data) : undefined,
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			}
		});
	}

	async patch<T = any>(
		url: string,
		data?: any,
		options: Omit<ApiRequestOptions, 'method'> = {}
	): Promise<T> {
		return this.fetch<T>(url, {
			...options,
			method: 'PATCH',
			body: data ? JSON.stringify(data) : undefined,
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			}
		});
	}

	async delete<T = any>(url: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<T> {
		return this.fetch<T>(url, { ...options, method: 'DELETE' });
	}

	async fetch<T = any>(url: string, options: ApiRequestOptions = {}): Promise<T> {
		const { showErrorNotification = true, autoJson = true, ...fetchOptions } = options;

		const apiFetch = this.ensureApiFetch();

		try {
			const response = await apiFetch(url, { ...fetchOptions, autoJson });

			if (autoJson && response instanceof Response) {
				if (!response.ok) {
					const errorMessage = `Request failed: ${response.status} ${response.statusText}`;
					if (showErrorNotification) {
						notificationService.error(errorMessage);
					}
					throw new Error(errorMessage);
				}
				return await response.json();
			}

			if (response instanceof Response && !response.ok) {
				const errorMessage = `Request failed: ${response.status} ${response.statusText}`;
				if (showErrorNotification) {
					notificationService.error(errorMessage);
				}
				throw new Error(errorMessage);
			}

			return response as T;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
			console.error('API request failed:', errorMessage);

			if (showErrorNotification && !errorMessage.includes('Request failed:')) {
				notificationService.error(errorMessage);
			}

			throw error;
		}
	}
}

export const apiService: ApiService = new ApiServiceClass();
