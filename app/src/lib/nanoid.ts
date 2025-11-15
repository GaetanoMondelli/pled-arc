// Simple client-side compatible nanoid-like function
// For more robust ID generation, consider the full 'nanoid' library and its custom alphabet features if needed.
// This basic version is usually sufficient for non-cryptographic unique IDs.

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DEFAULT_SIZE = 21;

export function nanoid(size: number = DEFAULT_SIZE): string {
  let id = "";
  // Use window.crypto if available for better randomness
  const crypto = typeof window !== "undefined" ? window.crypto || (window as any).msCrypto : null;

  if (crypto && crypto.getRandomValues) {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < size; i++) {
      id += ALPHABET[bytes[i] % ALPHABET.length];
    }
  } else {
    // Fallback to Math.random if crypto API is not available
    for (let i = 0; i < size; i++) {
      id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
  }
  return id;
}
