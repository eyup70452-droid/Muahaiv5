import CryptoJS from 'crypto-js';

const SECRET_KEY = 'ai_orchestrator_secure_key_123!';

export const encryptData = (data: string): string => {
  return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
};

export const decryptData = (ciphertext: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
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
