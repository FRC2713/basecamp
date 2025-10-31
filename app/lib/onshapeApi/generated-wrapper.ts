/**
 * Wrapper for the generated Onshape API client
 * This integrates the generated client with our existing authentication system
 */

import { client as generatedClient } from './generated/client.gen';
import { getValidOnshapeToken } from '../tokenRefresh';
import type { Client, Config } from './generated/client/types.gen';
import type { Auth } from './generated/core/auth.gen';

/**
 * Create a configured Onshape API client for use in server-side code
 * This automatically handles token refresh and authentication
 */
export async function createOnshapeApiClient(request: Request): Promise<Client> {
  const accessToken = await getValidOnshapeToken(request);
  
  if (!accessToken) {
    throw new Error('Not authenticated with Onshape');
  }

  // Configure the client with bearer token authentication
  // The auth callback will be called for each security requirement
  const config: Config = {
    auth: async (auth: Auth) => {
      // For bearer token auth, return the token (will be prefixed with "Bearer " by the client)
      if (auth.scheme === 'bearer' && auth.type === 'http') {
        return accessToken;
      }
      // For basic auth, you could return credentials here if needed
      // For now, we'll let bearer auth handle it
      return undefined;
    },
  };

  generatedClient.setConfig(config);
  return generatedClient;
}

/**
 * Get the base generated client (requires manual token management)
 * Useful for client-side code where you manage tokens yourself
 */
export function getOnshapeApiClient(accessToken: string): Client {
  const config: Config = {
    auth: async (auth: Auth) => {
      if (auth.scheme === 'bearer' && auth.type === 'http') {
        return accessToken;
      }
      return undefined;
    },
  };

  generatedClient.setConfig(config);
  return generatedClient;
}

/**
 * Re-export all SDK functions and types for convenience
 */
export * from './generated/sdk.gen';
export * from './generated/types.gen';
export { generatedClient };

