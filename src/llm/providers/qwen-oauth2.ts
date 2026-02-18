/**
 * Qwen OAuth2 authentication client
 * Reads credentials from ~/.qwen/oauth_creds.json and handles token refresh
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const QWEN_DIR = ".qwen";
const QWEN_CREDENTIAL_FILENAME = "oauth_creds.json";
const QWEN_OAUTH_BASE_URL = "https://chat.qwen.ai";
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`;
const QWEN_OAUTH_CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56";

export interface QwenCredentials {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expiry_date?: number;
  token_type?: string;
  resource_url?: string;
}

export interface TokenRefreshData {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  resource_url?: string;
}

export interface ErrorData {
  error: string;
  error_description: string;
}

export type TokenRefreshResponse = TokenRefreshData | ErrorData;

function isErrorResponse(response: TokenRefreshResponse): response is ErrorData {
  return "error" in response;
}

function getQwenCachedCredentialPath(): string {
  return path.join(os.homedir(), QWEN_DIR, QWEN_CREDENTIAL_FILENAME);
}

export async function loadQwenCredentials(): Promise<QwenCredentials | null> {
  const filePath = getQwenCachedCredentialPath();
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as QwenCredentials;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw new Error(
      `Failed to load Qwen credentials from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function saveQwenCredentials(credentials: QwenCredentials): Promise<void> {
  const filePath = getQwenCachedCredentialPath();
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const credString = JSON.stringify(credentials, null, 2);
    await fs.writeFile(filePath, credString);
  } catch (error: unknown) {
    throw new Error(
      `Failed to save Qwen credentials to ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function clearQwenCredentials(): Promise<void> {
  const filePath = getQwenCachedCredentialPath();
  try {
    await fs.unlink(filePath);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

export function isQwenTokenExpired(credentials: QwenCredentials): boolean {
  if (!credentials.expiry_date || credentials.expiry_date === 0) return true;
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // 5 minute buffer
  return now >= credentials.expiry_date - bufferMs;
}

export async function getQwenAccessToken(): Promise<string | null> {
  const credentials = await loadQwenCredentials();
  if (!credentials || !credentials.access_token) {
    return null;
  }

  if (isQwenTokenExpired(credentials)) {
    if (!credentials.refresh_token) {
      await clearQwenCredentials();
      return null;
    }

    try {
      const refreshed = await refreshQwenToken(credentials.refresh_token);
      if (refreshed && "access_token" in refreshed) {
        const newCredentials: QwenCredentials = {
          ...credentials,
          access_token: refreshed.access_token,
          token_type: refreshed.token_type,
          refresh_token: refreshed.refresh_token ?? credentials.refresh_token,
          resource_url: refreshed.resource_url ?? credentials.resource_url,
          expiry_date: Date.now() + refreshed.expires_in * 1000,
        };
        await saveQwenCredentials(newCredentials);
        return newCredentials.access_token ?? null;
      } else {
        await clearQwenCredentials();
        return null;
      }
    } catch (error: unknown) {
      await clearQwenCredentials();
      throw new Error(
        `Qwen token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return credentials.access_token ?? null;
}

export async function refreshQwenToken(refreshToken: string): Promise<TokenRefreshResponse> {
  const bodyData = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: QWEN_OAUTH_CLIENT_ID,
  };

  const params = new URLSearchParams(bodyData);

  const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  const responseText = await response.text();

  if (!response.ok) {
    if (response.status === 400) {
      try {
        const errorData = JSON.parse(responseText) as ErrorData;
        throw new Error(
          `Token refresh failed: ${errorData.error ?? "Unknown error"} - ${errorData.error_description ?? "No details"}`,
        );
      } catch {
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }
    }
    throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
  }

  const responseData = JSON.parse(responseText) as TokenRefreshResponse;

  if (isErrorResponse(responseData)) {
    throw new Error(
      `Token refresh failed: ${responseData.error ?? "Unknown error"} - ${responseData.error_description ?? "No details"}`,
    );
  }

  return responseData;
}
