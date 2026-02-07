// TOTP implementation using native Web Crypto API (Zero dependencies + Type Safe)

// Base32 helper
const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32Decode = (str: string): Uint8Array | null => {
    str = str.toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    let index = 0;
    const output = new Uint8Array(((str.length * 5) / 8) | 0);

    for (let i = 0; i < str.length; i++) {
        const idx = base32chars.indexOf(str[i]);
        if (idx === -1) return null;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            output[index++] = (value >>> (bits - 8)) & 0xff;
            bits -= 8;
        }
    }
    return output;
};

const base32Encode = (buffer: Uint8Array): string => {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
            output += base32chars[(value >>> (bits - 5)) & 0x1f];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += base32chars[(value << (5 - bits)) & 0x1f];
    }
    return output;
};

// HMAC-SHA1
async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        // Force type cast to resolve strict buffer check issues
        key as unknown as BufferSource,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        message as unknown as BufferSource
    );
    return new Uint8Array(signature);
}

// Generate TOTP token
async function generateToken(secret: string, window: number = 0): Promise<string> {
    const keyBytes = base32Decode(secret);
    if (!keyBytes) throw new Error('Invalid Base32 secret');

    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30) + window;

    const counterBytes = new Uint8Array(8);
    let val = counter;
    for (let i = 7; i >= 0; i--) {
        counterBytes[i] = val & 0xff;
        val = Math.floor(val / 256); // Use Math.floor for safe integer division
    }

    const hash = await hmacSha1(keyBytes, counterBytes);

    const offset = hash[hash.length - 1] & 0xf;
    const binary =
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
}

// Get the TOTP secret from environment
const getTotpSecret = (): string | null => {
    return import.meta.env.VITE_TOTP_SECRET || null;
};

// Verify a TOTP code
// NOTE: async because of Web Crypto API
export const verifyTotpCode = async (code: string): Promise<boolean> => {
    const secret = getTotpSecret();
    if (!secret) return false;

    try {
        // Check current, prev, and next windows (30s tolerance)
        const validCurrent = await generateToken(secret, 0);
        if (validCurrent === code) return true;

        const validPrev = await generateToken(secret, -1);
        if (validPrev === code) return true;

        const validNext = await generateToken(secret, 1);
        if (validNext === code) return true;

        return false;
    } catch (e) {
        console.error('TOTP verify error:', e);
        return false;
    }
};

// Generate a random Base32 secret
export const generateTotpSecret = (): string => {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return base32Encode(bytes);
};

export const isTotpEnabled = (): boolean => {
    return !!getTotpSecret();
};

// Generate otpauth URI
export const generateSetupUri = (accountName: string = 'Admin', issuer: string = 'VibeCoding'): { secret: string; uri: string } => {
    const secret = generateTotpSecret();
    const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    return { secret, uri };
};
