// Utility for client-side encryption/decryption using Web Crypto API

export async function generateKey(): Promise<CryptoKey> {
    return window.crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );
}

export async function exportKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey("jwk", key);
    // Encode as base64url for URL safety
    const json = JSON.stringify(exported);
    return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function importKey(keyStr: string): Promise<CryptoKey> {
    // Decode base64url
    const base64 = keyStr.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    const json = atob(padded);
    const jwk = JSON.parse(json);
    
    return window.crypto.subtle.importKey(
        "jwk",
        jwk,
        {
            name: "AES-GCM",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );
}

export async function encryptPassword(password: string): Promise<{ encrypted: string; keyStr: string }> {
    const key = await generateKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    
    const encryptedContent = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        enc.encode(password)
    );

    const encryptedArray = new Uint8Array(encryptedContent);
    // Combine IV and Ciphertext: IV (12 bytes) + Ciphertext
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);

    // Convert to base64
    const encryptedBase64 = btoa(String.fromCharCode(...combined));
    const keyStr = await exportKey(key);

    return { encrypted: encryptedBase64, keyStr };
}

export async function decryptPassword(encryptedBase64: string, keyStr: string): Promise<string> {
    const key = await importKey(keyStr);
    
    const combinedStr = atob(encryptedBase64);
    const combined = new Uint8Array(combinedStr.length);
    for (let i = 0; i < combinedStr.length; i++) {
        combined[i] = combinedStr.charCodeAt(i);
    }

    // Extract IV (first 12 bytes)
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decryptedContent = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        data
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedContent);
}
