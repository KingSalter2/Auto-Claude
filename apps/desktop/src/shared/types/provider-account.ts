import type { ClaudeUsageData, ClaudeRateLimitEvent } from './agent';

/** How a credential was resolved — shown in UI for transparency */
export type CredentialSource = 'oauth' | 'api-key' | 'env' | 'keychain';

/** Supported built-in providers (matches @ai-sdk/* packages) */
export type BuiltinProvider =
  | 'anthropic' | 'openai' | 'google' | 'amazon-bedrock' | 'azure'
  | 'mistral' | 'groq' | 'xai' | 'ollama' | 'openai-compatible';

export type BillingModel = 'subscription' | 'pay-per-use';

/** A credential entry for any AI provider */
export interface ProviderAccount {
  id: string;
  provider: BuiltinProvider;
  name: string;
  authType: 'oauth' | 'api-key';
  billingModel: BillingModel;
  apiKey?: string;
  baseUrl?: string;
  region?: string;
  createdAt: number;
  updatedAt: number;
  claudeProfileId?: string;
  usage?: ClaudeUsageData;
  rateLimitEvents?: ClaudeRateLimitEvent[];
}

export type ProviderCategory = 'popular' | 'infrastructure' | 'local';

/** Provider display metadata for UI rendering */
export interface ProviderInfo {
  id: BuiltinProvider;
  name: string;
  description: string;
  category: ProviderCategory;
  authMethods: ('oauth' | 'api-key')[];
  envVars: string[];
  configFields: ('baseUrl' | 'region')[];
  website?: string;
}
