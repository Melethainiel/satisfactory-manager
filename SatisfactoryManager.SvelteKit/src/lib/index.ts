// place files you want to import through the `$lib` alias in this folder.

// Azure AD B2C Authentication exports
export {
	initializeMsal,
	signIn,
	signOut,
	getAccessToken,
	isAuthenticated,
	getCurrentUser,
	clearError,
	isLoading,
	authState,
	type UserInfo,
	type AuthState,
	type AzureB2CConfig
} from './auth/azureB2C';

export { azureB2CConfig } from './auth/config';
export { apiClient, ApiClient, createApiClient, type ApiResponse, type ApiRequestOptions, type ApiConfig } from './auth/apiClient';
export { authHandle, requireAuth } from './auth/guard';
