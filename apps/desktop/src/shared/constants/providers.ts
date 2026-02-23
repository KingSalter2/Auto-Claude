import type { ProviderInfo } from '../types/provider-account';

export const PROVIDER_REGISTRY: ProviderInfo[] = [
  {
    id: 'anthropic', name: 'Anthropic', description: 'Claude models',
    authMethods: ['oauth', 'api-key'], envVars: ['ANTHROPIC_API_KEY'],
    configFields: [], website: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openai', name: 'OpenAI', description: 'GPT and o-series models',
    authMethods: ['api-key'], envVars: ['OPENAI_API_KEY'],
    configFields: [], website: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'google', name: 'Google AI', description: 'Gemini models',
    authMethods: ['api-key'], envVars: ['GOOGLE_GENERATIVE_AI_API_KEY'],
    configFields: [], website: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'mistral', name: 'Mistral', description: 'Mistral and Codestral models',
    authMethods: ['api-key'], envVars: ['MISTRAL_API_KEY'],
    configFields: [], website: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'groq', name: 'Groq', description: 'Ultra-fast LLaMA inference',
    authMethods: ['api-key'], envVars: ['GROQ_API_KEY'],
    configFields: [], website: 'https://console.groq.com/keys',
  },
  {
    id: 'xai', name: 'xAI', description: 'Grok models',
    authMethods: ['api-key'], envVars: ['XAI_API_KEY'],
    configFields: [], website: 'https://console.x.ai',
  },
  {
    id: 'amazon-bedrock', name: 'AWS Bedrock', description: 'AWS-hosted models',
    authMethods: ['api-key'], envVars: ['AWS_ACCESS_KEY_ID'],
    configFields: ['region'],
  },
  {
    id: 'azure', name: 'Azure OpenAI', description: 'Azure-hosted OpenAI models',
    authMethods: ['api-key'], envVars: ['AZURE_OPENAI_API_KEY'],
    configFields: ['baseUrl'],
  },
  {
    id: 'ollama', name: 'Ollama', description: 'Local open-source models',
    authMethods: [], envVars: [],
    configFields: ['baseUrl'],
  },
  {
    id: 'openai-compatible', name: 'Custom Endpoint', description: 'Any OpenAI-compatible API (OpenRouter, proxies, local servers)',
    authMethods: ['api-key'], envVars: [],
    configFields: ['baseUrl'],
  },
];
