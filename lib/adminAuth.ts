// Admin authentication utilities with security hardening

// Generate a secure session token
export async function generateAuthToken(passwordHash: string): Promise<string> {
    const timestamp = Date.now();
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const randomHex = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    // Create a signed token: timestamp.random.signature
    const payload = `${timestamp}.${randomHex}`;
    const signature = await sha256(`${payload}.${passwordHash}`);

    return `${payload}.${signature.slice(0, 32)}`;
}

// Validate an auth token
export async function validateAuthToken(token: string, passwordHash: string): Promise<boolean> {
    if (!token || typeof token !== 'string') return false;

    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [timestampStr, randomHex, providedSignature] = parts;
    const timestamp = parseInt(timestampStr, 10);

    // Check timestamp is valid number
    if (isNaN(timestamp)) return false;

    // Check token is not too old (15 minutes max)
    const maxAge = 15 * 60 * 1000;
    if (Date.now() - timestamp > maxAge) return false;

    // Check token is not from the future (with 1 minute tolerance)
    if (timestamp > Date.now() + 60000) return false;

    // Verify signature
    const payload = `${timestamp}.${randomHex}`;
    const expectedSignature = await sha256(`${payload}.${passwordHash}`);

    // Constant-time comparison to prevent timing attacks
    if (providedSignature.length !== 32) return false;

    let match = true;
    for (let i = 0; i < 32; i++) {
        if (providedSignature[i] !== expectedSignature[i]) {
            match = false;
        }
    }

    return match;
}

// SHA-256 hash function
async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Storage key (obfuscated)
const AUTH_KEY = '_as_t';

// Store auth token
export function storeAuthToken(token: string): void {
    try {
        localStorage.setItem(AUTH_KEY, token);
    } catch {
        // Storage might be full or blocked
    }
}

// Get stored auth token
export function getStoredAuthToken(): string | null {
    try {
        return localStorage.getItem(AUTH_KEY);
    } catch {
        return null;
    }
}

// Clear auth token
export function clearAuthToken(): void {
    try {
        localStorage.removeItem(AUTH_KEY);
    } catch {
        // Ignore
    }
}

// Quick check if potentially authenticated (for UI, not security)
export function hasAuthToken(): boolean {
    const token = getStoredAuthToken();
    if (!token) return false;

    // Basic format check
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    // Quick timestamp check
    const timestamp = parseInt(parts[0], 10);
    if (isNaN(timestamp)) return false;

    const maxAge = 15 * 60 * 1000;
    return Date.now() - timestamp <= maxAge;
}
