import * as fs from 'fs';
import * as path from 'path';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

interface GoogleClientSecretJson {
  installed?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
}

function parseDotEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const result: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex < 1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

function getEnvSearchDirectories(): string[] {
  const directories: string[] = [];
  const resourcesPath = typeof process.resourcesPath === 'string' ? process.resourcesPath : '';
  const execDir = process.execPath ? path.dirname(process.execPath) : '';

  directories.push(process.cwd());
  if (execDir) {
    directories.push(execDir);
    directories.push(path.join(execDir, 'resources'));
    directories.push(path.join(execDir, 'resources', 'runtime-config'));
  }
  if (resourcesPath) {
    directories.push(resourcesPath);
    directories.push(path.join(resourcesPath, 'runtime-config'));
  }

  return Array.from(new Set(directories.filter(Boolean)));
}

function loadMergedEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  let fileEnv: Record<string, string> = {};
  const directories = getEnvSearchDirectories();

  for (const dir of directories) {
    fileEnv = {
      ...fileEnv,
      ...parseDotEnvFile(path.join(dir, '.env')),
      ...parseDotEnvFile(path.join(dir, '.env.local')),
    };
  }

  return {
    ...fileEnv,
    ...(env as Record<string, string>),
  };
}

function resolveFromEnvSearchDirectories(targetPath: string): string | null {
  if (!targetPath) {
    return null;
  }

  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  for (const dir of getEnvSearchDirectories()) {
    const candidate = path.join(dir, targetPath);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(process.cwd(), targetPath);
}

function readGoogleClientJson(mergedEnv: Record<string, string>): GoogleClientSecretJson | null {
  const jsonInline = mergedEnv.GOOGLE_OAUTH_CLIENT_JSON;
  if (jsonInline) {
    try {
      return JSON.parse(jsonInline) as GoogleClientSecretJson;
    } catch {
      throw new Error('GOOGLE_OAUTH_CLIENT_JSON is not valid JSON.');
    }
  }

  const jsonFilePath = mergedEnv.GOOGLE_OAUTH_CLIENT_JSON_FILE;
  if (!jsonFilePath) {
    return null;
  }

  const resolved = resolveFromEnvSearchDirectories(jsonFilePath);

  if (!resolved || !fs.existsSync(resolved)) {
    throw new Error(`GOOGLE_OAUTH_CLIENT_JSON_FILE not found: ${resolved}`);
  }

  try {
    const raw = fs.readFileSync(resolved, 'utf-8');
    return JSON.parse(raw) as GoogleClientSecretJson;
  } catch {
    throw new Error(`Failed to parse Google OAuth client JSON file: ${resolved}`);
  }
}

/**
 * Load Google OAuth config from environment variables.
 * Sources (highest precedence first): process env, .env.local, .env,
 * then optional GOOGLE_OAUTH_CLIENT_JSON / GOOGLE_OAUTH_CLIENT_JSON_FILE.
 */
export function getGoogleOAuthConfig(env: NodeJS.ProcessEnv = process.env): GoogleOAuthConfig {
  const mergedEnv = loadMergedEnv(env);
  const oauthJson = readGoogleClientJson(mergedEnv);
  const oauthJsonSection = oauthJson?.installed || oauthJson?.web || {};

  const clientId = mergedEnv.GOOGLE_CLIENT_ID || oauthJsonSection.client_id || '';
  const clientSecret = mergedEnv.GOOGLE_CLIENT_SECRET || oauthJsonSection.client_secret || '';
  const redirectUri =
    mergedEnv.GOOGLE_REDIRECT_URI ||
    oauthJsonSection.redirect_uris?.find((uri) => uri.includes('localhost:8976/oauth2callback')) ||
    'http://localhost:8976/oauth2callback';

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Google OAuth is not configured. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI, or provide GOOGLE_OAUTH_CLIENT_JSON(_FILE).'
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    authUrl: 'https://accounts.google.com/o/oauth2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  };
}
