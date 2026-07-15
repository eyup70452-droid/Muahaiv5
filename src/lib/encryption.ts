import CryptoJS from 'crypto-js';

const getSecretKey = (): string => {
  if (typeof window === "undefined") {
    return "ai_orch_server_fallback";
  }
  let deviceId = localStorage.getItem("ai_nexus_device_id");
  if (!deviceId) {
    deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("ai_nexus_device_id", deviceId);
  }
  const part1 = "ai_orch_secure_";
  const part2 = deviceId.substring(0, 12);
  const part3 = window.location.hostname || "localhost";
  return part1 + part2 + "_" + part3;
};

export const encryptData = (data: string): string => {
  return CryptoJS.AES.encrypt(data, getSecretKey()).toString();
};

export const decryptData = (ciphertext: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, getSecretKey());
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (decrypted) return decrypted;
    throw new Error("Mismatch");
  } catch (e) {
    // Soft migration from legacy hardcoded key to prevent breaking existing user sessions
    try {
      const legacyKey = 'ai_orchestrator_secure_key_123!';
      const bytesLegacy = CryptoJS.AES.decrypt(ciphertext, legacyKey);
      const legacyDecrypted = bytesLegacy.toString(CryptoJS.enc.Utf8);
      if (legacyDecrypted) {
        return legacyDecrypted;
      }
    } catch (e2) {}
    return "";
  }
};

export const getApiKeys = (): Record<string, string> => {
  const enc = localStorage.getItem("ai_nexus_keys_secure");
  if (enc) {
    const dec = decryptData(enc);
    if (dec) {
      try {
        return JSON.parse(dec);
      } catch (e) {
        return {};
      }
    }
  }
  // Fallback to old keys for migration
  const old = localStorage.getItem("ai_nexus_keys");
  if (old) {
    try {
      const parsed = JSON.parse(old);
      setApiKeys(parsed);
      localStorage.removeItem("ai_nexus_keys");
      return parsed;
    } catch(e) {}
  }
  return {};
}

export const setApiKeys = (keys: Record<string, string>) => {
  const enc = encryptData(JSON.stringify(keys));
  localStorage.setItem("ai_nexus_keys_secure", enc);
}
