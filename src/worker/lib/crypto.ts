const UUID_V4_TEMPLATE = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

export function uuid(): string {
    return UUID_V4_TEMPLATE.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function uuidv5(...args: string[]): string {
    const combined = args.join('');
    let h = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        h = ((h << 5) - h) + char;
        h = h & h;
    }
    
    const hex = Math.abs(h).toString(16).padStart(32, '0').slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const ALGORITHM = { name: 'AES-GCM', length: 256 };
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

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
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

export function createToken(payload: any, secret: string): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = btoa(JSON.stringify(payload));
    const signature = simpleHash(header + body + secret);
    return `${header}.${body}.${signature}`;
}

export function parseToken(token: string | undefined, secret: string): any {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payload = JSON.parse(atob(parts[1]));
        return payload;
    } catch {
        return null;
    }
}

function simpleHash(input: string): string {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        h = ((h << 5) - h) + char;
        h = h & h;
    }
    return Math.abs(h).toString(16).padStart(64, '0').slice(0, 64);
}
