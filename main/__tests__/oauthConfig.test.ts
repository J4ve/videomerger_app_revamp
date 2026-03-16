import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getGoogleOAuthConfig } from '../oauthConfig';

describe('getGoogleOAuthConfig', () => {
  it('returns config when env vars are present', () => {
    const config = getGoogleOAuthConfig({
      GOOGLE_CLIENT_ID: 'id-123',
      GOOGLE_CLIENT_SECRET: 'secret-456',
      GOOGLE_REDIRECT_URI: 'http://localhost:8976/oauth2callback',
    } as any);

    expect(config.clientId).toBe('id-123');
    expect(config.clientSecret).toBe('secret-456');
    expect(config.redirectUri).toBe('http://localhost:8976/oauth2callback');
  });

  it('throws when required env vars are missing', () => {
    expect(() => getGoogleOAuthConfig({
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      GOOGLE_REDIRECT_URI: '',
      GOOGLE_OAUTH_CLIENT_JSON: '',
      GOOGLE_OAUTH_CLIENT_JSON_FILE: '',
    } as any)).toThrow(/Google OAuth is not configured/i);
  });

  it('loads from inline GOOGLE_OAUTH_CLIENT_JSON when env vars are absent', () => {
    const config = getGoogleOAuthConfig({
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      GOOGLE_REDIRECT_URI: '',
      GOOGLE_OAUTH_CLIENT_JSON_FILE: '',
      GOOGLE_OAUTH_CLIENT_JSON: JSON.stringify({
        installed: {
          client_id: 'json-client-id',
          client_secret: 'json-client-secret',
          redirect_uris: ['http://localhost:8976/oauth2callback'],
        },
      }),
    } as any);

    expect(config.clientId).toBe('json-client-id');
    expect(config.clientSecret).toBe('json-client-secret');
    expect(config.redirectUri).toBe('http://localhost:8976/oauth2callback');
  });

  it('loads env values from packaged runtime-config when cwd has no env files', () => {
    const originalResourcesPath = (process as any).resourcesPath;
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oauth-config-'));
    const resourcesRuntimeConfig = path.join(tmpRoot, 'runtime-config');
    const jsonFilePath = path.join(resourcesRuntimeConfig, 'client.json');

    fs.mkdirSync(resourcesRuntimeConfig, { recursive: true });
    fs.writeFileSync(jsonFilePath, JSON.stringify({
      installed: {
        client_id: 'packaged-id',
        client_secret: 'packaged-secret',
        redirect_uris: ['http://localhost:8976/oauth2callback'],
      },
    }), 'utf-8');

    Object.defineProperty(process, 'resourcesPath', {
      value: tmpRoot,
      configurable: true,
    });

    try {
      const config = getGoogleOAuthConfig({
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
        GOOGLE_REDIRECT_URI: '',
        GOOGLE_OAUTH_CLIENT_JSON: '',
        GOOGLE_OAUTH_CLIENT_JSON_FILE: 'runtime-config/client.json',
      } as any);
      expect(config.clientId).toBe('packaged-id');
      expect(config.clientSecret).toBe('packaged-secret');
      expect(config.redirectUri).toBe('http://localhost:8976/oauth2callback');
    } finally {
      Object.defineProperty(process, 'resourcesPath', {
        value: originalResourcesPath,
        configurable: true,
      });
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
