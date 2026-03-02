import { v4, v5 } from 'uuid';

const ALGORITHM = { name: 'AES-GCM', length: 256 };
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

async function getKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        ALGORITHM,
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encrypt(value: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await getKey(secret, salt);

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(value)
    );

    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
}

export async function decrypt(value: string, secret: string): Promise<string> {
    const decoder = new TextDecoder();
    const combined = Uint8Array.from(atob(value), c => c.charCodeAt(0));

    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH);

    const key = await getKey(secret, salt);

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
    );

    return decoder.decode(decrypted);
}

export async function hash(...args: string[]): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(args.join(''));
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function md5(...args: string[]): string {
    return 'md5-not-supported-in-workers';
}

export function secret(env: { APP_SECRET: string }): string {
    return env.APP_SECRET;
}

export function uuid(...args: any[]): string {
    if (args.length) {
        const namespace = v5('umami.is', v5.DNS);
        return v5(args.join(''), namespace);
    }
    return v4();
}

export async function createSecureToken(payload: any, secret: string): Promise<string> {
    const json = JSON.stringify(payload);
    return encrypt(json, secret);
}

export async function parseSecureToken(token: string | undefined, secret: string): Promise<any> {
    if (!token) return null;
    try {
        const json = await decrypt(token, secret);
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export function parseToken(token: string | undefined, secret: string): any {
    if (!token) return null;
    try {
        const [payloadB64] = token.split('.');
        const payload = JSON.parse(atob(payloadB64));
        return payload;
    } catch {
        return null;
    }
}
