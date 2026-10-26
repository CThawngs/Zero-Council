/**
 * Dedicated helper file for encryption and decryption with AES-256 standard
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

// Lấy secret key 32-byte từ biến môi trường (phải đảm bảo độ dài chính xác)
function getSecretKey(): Buffer {
    const secretHex = process.env.ENCRYPTION_KEY;
    if (!secretHex)
        throw new Error('ENCRYPTION_KEY environment variable is missing.');
    return Buffer.from(secretHex, 'hex');
}

/**
 * Mã hóa chuỗi API Key của người dùng trước khi lưu xuống Database
 */
export function encryptKey(plainTextKey: string): string {
    const iv = crypto.randomBytes(16); // Khởi tạo vector ngẫu nhiên
    const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
    
    let encrypted = cipher.update(plainTextKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Lưu dưới dạng iv:encrypted_data để quá trình giải mã có thể tách lấy iv đúng
    return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Giải mã khóa API khi cần gọi dịch vụ AI
 */
export function decryptKey(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) {
        throw new Error('Invalid encrypted key format.');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}