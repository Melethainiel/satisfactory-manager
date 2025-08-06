# Azure AD B2C Authentication Setup

This directory contains a complete Azure AD B2C authentication implementation for your SvelteKit application using redirect flow.

## Files Overview

- **`azureB2C.ts`** - Main authentication module with MSAL configuration and functions
- **`config.ts`** - Configuration file for Azure B2C settings
- **`apiClient.ts`** - API client with automatic token attachment
- **`guard.ts`** - Route protection utilities
- **`AuthComponent.svelte`** - Example Svelte component showing authentication UI

## Setup Instructions

### 1. Azure AD B2C Configuration

1. **Create an Azure AD B2C tenant** (if you don't have one)
   - Go to Azure Portal → Create a resource → Azure Active Directory B2C

2. **Register your application**
   - Go to your B2C tenant → App registrations → New registration
   - Name: Your application name
   - Supported account types: Accounts in any identity provider or organizational directory
   - Redirect URI: 
     - Type: Single-page application (SPA)
     - URL: `http://localhost:5173` (for development)

3. **Configure authentication**
   - In your app registration → Authentication
   - Add platform → Single-page application
   - Add redirect URIs for all your environments
   - Enable ID tokens and access tokens

4. **Create user flows**
   - Go to B2C tenant → User flows → New user flow
   - Create a "Sign up and sign in" flow
   - Choose the attributes you want to collect

### 2. Environment Configuration

Create a `.env.local` file in your SvelteKit project root with the following variables:

```env
# Azure AD B2C Configuration
AZURE_B2C_CLIENT_ID=your-application-client-id
AZURE_B2C_AUTHORITY=https://yourtenant.b2clogin.com/yourtenant.onmicrosoft.com/B2C_1_SIGNIN_SIGNUP
AZURE_B2C_KNOWN_AUTHORITY=yourtenant.b2clogin.com
AZURE_B2C_REDIRECT_URI=http://localhost:5173
AZURE_B2C_POST_LOGOUT_REDIRECT_URI=http://localhost:5173

# API Configuration (optional)
API_BASE_URL=https://your-api-url.com
```

### 3. Update Configuration

Update the values in `src/lib/auth/config.ts`:

```typescript
export const azureB2CConfig: AzureB2CConfig = {
	clientId: 'your-actual-client-id',
	authority: 'https://yourtenant.b2clogin.com/yourtenant.onmicrosoft.com/B2C_1_SIGNIN_SIGNUP',
	knownAuthorities: ['yourtenant.b2clogin.com'],
	// ... other settings
};
```

## Usage Examples

### Basic Authentication in a Svelte Component

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { authState, initializeMsal, signIn, signOut } from '$lib';
	import { azureB2CConfig } from '$lib';

	onMount(async () => {
		await initializeMsal(azureB2CConfig);
	});
</script>

{#if $authState.isAuthenticated}
	<p>Welcome, {$authState.user?.displayName}!</p>
	<button on:click={signOut}>Sign Out</button>
{:else}
	<button on:click={signIn}>Sign In</button>
{/if}
```

### Making Authenticated API Calls

```typescript
import { apiClient } from '$lib';

// GET request with automatic token
const response = await apiClient.get('/api/user/profile');

// POST request with data
const createResponse = await apiClient.post('/api/items', {
	name: 'New Item',
	description: 'Item description'
});

if (response.error) {
	console.error('API Error:', response.error);
} else {
	console.log('Data:', response.data);
}
```

### Route Protection

```typescript
// In your +layout.server.ts or hooks.server.ts
import { authHandle } from '$lib';

export const handle = authHandle;
```

### Custom API Client with Different Scopes

```typescript
import { createApiClient } from '$lib';

const customApiClient = createApiClient({
	baseUrl: 'https://api.myservice.com',
	defaultScopes: ['https://myapi.onmicrosoft.com/access']
});
```

## Key Features

### Authentication Functions
- `initializeMsal()` - Initialize the authentication system
- `signIn()` - Trigger sign-in redirect
- `signOut()` - Sign out and redirect
- `getAccessToken()` - Get valid access token for API calls
- `isAuthenticated()` - Check authentication status
- `getCurrentUser()` - Get current user information

### Reactive Stores
- `authState` - Svelte store with complete authentication state
- Automatically updates when authentication status changes

### API Integration
- Automatic token attachment to API requests
- Token refresh handling
- Error handling for authentication failures

### Security Features
- Uses session storage for tokens (more secure than local storage)
- Automatic token refresh
- Proper error handling for expired tokens
- CSRF protection through SameSite cookies

## Troubleshooting

### Common Issues

1. **"MSAL instance not initialized"**
   - Make sure to call `initializeMsal()` before other auth functions
   - Usually done in your main layout or app component

2. **Redirect loops**
   - Check that your redirect URIs match exactly in Azure and your config
   - Ensure URLs don't have trailing slashes if not expected

3. **Token acquisition fails**
   - Verify your scopes are correctly configured
   - Check that your API is properly configured to accept tokens from your B2C tenant

4. **CORS errors**
   - Ensure your API allows requests from your frontend domain
   - Configure proper CORS headers on your backend

### Debug Mode

To enable debug logging, modify the logger configuration in `azureB2C.ts`:

```typescript
logLevel: LogLevel.Verbose // Change from Warning to Verbose
```

## Security Considerations

1. **Use HTTPS in production** - Never use HTTP for authentication in production
2. **Validate tokens on the backend** - Always validate tokens server-side
3. **Use appropriate token lifetimes** - Configure reasonable token expiration times
4. **Monitor for suspicious activity** - Implement logging and monitoring
5. **Keep dependencies updated** - Regularly update MSAL and other security-related packages

## Additional Resources

- [Azure AD B2C Documentation](https://docs.microsoft.com/en-us/azure/active-directory-b2c/)
- [MSAL.js Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-js-initializing-client-applications)
- [SvelteKit Authentication Guide](https://kit.svelte.dev/docs/authentication)
