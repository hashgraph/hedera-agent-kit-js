import { PrivateKey, PublicKey } from '@hiero-ledger/sdk';
import { describe, it, expect, beforeEach } from 'vitest';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

describe('HederaParameterNormaliser.resolveKey', () => {
  // Generate stable keys for testing
  const pk_ed25519 = PrivateKey.generateED25519();
  const pk_ecdsa = PrivateKey.generateECDSA();

  const ed25519PublicKey = pk_ed25519.publicKey;
  const ecdsaPublicKey = pk_ecdsa.publicKey;

  // Various formats for ED25519
  const ed25519Der = ed25519PublicKey.toStringDer();
  const ed25519Raw = ed25519PublicKey.toStringRaw();

  // Various formats for ECDSA
  const ecdsaDer = ecdsaPublicKey.toStringDer();
  const ecdsaRaw = ecdsaPublicKey.toStringRaw();

  let userPublicKey: PublicKey;

  beforeEach(() => {
    // A fallback key to use when 'true' is passed
    userPublicKey = ed25519PublicKey;
  });

  describe('Utility: input type handling', () => {
    it('should return undefined when rawValue is undefined', () => {
      const result = (HederaParameterNormaliser as any).resolveKey(undefined, userPublicKey);
      expect(result).toBeUndefined();
    });

    it('should return userKey when rawValue is true', () => {
      const result = (HederaParameterNormaliser as any).resolveKey(true, userPublicKey);
      expect(result).toBe(userPublicKey);
    });

    it('should return userKey when rawValue is string "true"', () => {
      const result = (HederaParameterNormaliser as any).resolveKey("true", userPublicKey);
      expect(result).toBe(userPublicKey);
    });

    it('should return undefined when rawValue is false', () => {
      const result = (HederaParameterNormaliser as any).resolveKey(false, userPublicKey);
      expect(result).toBeUndefined();
    });

    it('should return undefined when rawValue is string "false"', () => {
      const result = (HederaParameterNormaliser as any).resolveKey("false", userPublicKey);
      expect(result).toBeUndefined();
    });
  });

  describe('ED25519 Key Resolution', () => {
    it('should parse ED25519 DER-encoded string', () => {
      const result = (HederaParameterNormaliser as any).resolveKey(ed25519Der, userPublicKey);
      expect(result).toBeInstanceOf(PublicKey);
      expect(result.toStringDer()).toBe(ed25519Der);
    });

    it('should parse ED25519 raw hex string', () => {
      const result = (HederaParameterNormaliser as any).resolveKey(ed25519Raw, userPublicKey);
      expect(result).toBeInstanceOf(PublicKey);
      expect(result.toStringRaw()).toBe(ed25519Raw);
    });
  });

  describe('ECDSA Key Resolution', () => {
    it('should parse ECDSA DER-encoded string', () => {
      const result = (HederaParameterNormaliser as any).resolveKey(ecdsaDer, userPublicKey);
      expect(result).toBeInstanceOf(PublicKey);
      expect(result.toStringDer()).toBe(ecdsaDer);
    });

    it('should parse ECDSA raw hex string', () => {
      const result = (HederaParameterNormaliser as any).resolveKey(ecdsaRaw, userPublicKey);
      expect(result).toBeInstanceOf(PublicKey);
      expect(result.toStringRaw()).toBe(ecdsaRaw);
    });
  });

  describe('Error Handling & Falbacks', () => {
    it('should throw Error for invalid key string', () => {
      const invalid = 'not-a-key';
      expect(() =>
        (HederaParameterNormaliser as any).resolveKey(invalid, userPublicKey)
      ).toThrow(/Failed to parse public key from string/);
    });

    it('should throw Error for empty string', () => {
      expect(() =>
        (HederaParameterNormaliser as any).resolveKey('', userPublicKey)
      ).toThrow(/Failed to parse public key from string/);
    });

    it('should handle generic PublicKey.fromString fallback', () => {
      // We'll use a DER string which always works with generic fromString
      const result = (HederaParameterNormaliser as any).resolveKey(ed25519Der, userPublicKey);
      expect(result).toBeInstanceOf(PublicKey);
      expect(result.toStringDer()).toBe(ed25519Der);
    });
  });

  describe('Cross-type Independence', () => {
    it('should correctly distinguish between ED25519 and ECDSA formats', () => {
      const resEd = (HederaParameterNormaliser as any).resolveKey(ed25519Der, userPublicKey);
      const resEc = (HederaParameterNormaliser as any).resolveKey(ecdsaDer, userPublicKey);

      expect(resEd.toStringDer()).not.toBe(resEc.toStringDer());
      expect(resEd.toStringDer()).toBe(ed25519Der);
      expect(resEc.toStringDer()).toBe(ecdsaDer);
    });
  });

  describe('Compatibility & Real-world Scenarios', () => {
    it('should handle typical update transaction parameter sets', () => {
      const params = {
        key1: ed25519Der,
        key2: true,
        key3: false,
        key4: undefined,
        key5: ecdsaRaw
      };

      const resolved = {
        key1: (HederaParameterNormaliser as any).resolveKey(params.key1, userPublicKey),
        key2: (HederaParameterNormaliser as any).resolveKey(params.key2, userPublicKey),
        key3: (HederaParameterNormaliser as any).resolveKey(params.key3, userPublicKey),
        key4: (HederaParameterNormaliser as any).resolveKey(params.key4, userPublicKey),
        key5: (HederaParameterNormaliser as any).resolveKey(params.key5, userPublicKey),
      };

      expect(resolved.key1.toStringDer()).toBe(ed25519Der);
      expect(resolved.key2).toBe(userPublicKey);
      expect(resolved.key3).toBeUndefined();
      expect(resolved.key4).toBeUndefined();
      expect(resolved.key5.toStringRaw()).toBe(ecdsaRaw);
    });
  });
});
