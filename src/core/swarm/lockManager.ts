import fs from 'fs';
import path from 'path';

const LOCK_DIR = path.join(process.cwd(), 'tmp', 'locks');

export class FileLockManager {
  static init() {
    if (!fs.existsSync(LOCK_DIR)) {
      fs.mkdirSync(LOCK_DIR, { recursive: true });
    }
  }

  static getLockFilePath(filePath: string) {
    // encode path to safe filename
    const safeName = Buffer.from(filePath).toString('base64').replace(/\//g, '_');
    return path.join(LOCK_DIR, `${safeName}.lock`);
  }

  static async acquireLock(filePath: string, agentName: string, timeoutMs: number = 5000): Promise<boolean> {
    this.init();
    const lockFile = this.getLockFilePath(filePath);
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        fs.writeFileSync(lockFile, agentName, { flag: 'wx' }); // 'wx' fails if file exists
        return true;
      } catch (err: any) {
        if (err.code === 'EEXIST') {
          // Lock exists, wait
          await new Promise(r => setTimeout(r, 100));
        } else {
          throw err;
        }
      }
    }
    return false; // Timed out
  }

  static releaseLock(filePath: string, agentName: string) {
    const lockFile = this.getLockFilePath(filePath);
    try {
      if (fs.existsSync(lockFile)) {
        const owner = fs.readFileSync(lockFile, 'utf-8');
        if (owner === agentName || agentName === 'FORCE') {
          fs.unlinkSync(lockFile);
          return true;
        }
      }
    } catch (e) {
      console.error("Lock release error:", e);
    }
    return false;
  }
}
