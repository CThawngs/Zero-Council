/**
 * File tiện ích chuyên dụng để mã hóa và giải mã dữ liệu
 * bằng thuật toán AES-256-GCM.
 */
import 'server-only';
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Lấy khóa bí mật 32 byte từ biến môi trường
function getSecretKey(): Buffer {
    const secretHex = process.env.ENCRYPTION_KEY;

    // Kiểm tra khóa có tồn tại và đúng định dạng 64 ký tự hex
    if (!secretHex || !/^[0-9a-fA-F]{64}$/.test(secretHex)) {
        throw new Error(
            'ENCRYPTION_KEY phải là khóa 32 byte (64 ký tự hex) hợp lệ.'
        );
    }

    return Buffer.from(secretHex, 'hex');
}

/**
 * Mã hóa API Key của người dùng trước khi lưu vào cơ sở dữ liệu
 */
export function encryptKey(plainTextKey: string): string {
    // Tạo vector khởi tạo (IV) ngẫu nhiên dài 12 byte
    const iv = crypto.randomBytes(IV_LENGTH);

    // Khởi tạo bộ mã hóa AES-256-GCM
    const cipher = crypto.createCipheriv(
        ALGORITHM,
        getSecretKey(),
        iv,
        { authTagLength: AUTH_TAG_LENGTH }
    );

    // Tiến hành mã hóa dữ liệu
    const encrypted = Buffer.concat([
        cipher.update(plainTextKey, 'utf8'),
        cipher.final(),
    ]);

    // Lấy mã xác thực (Authentication Tag) dài 16 byte
    const authTag = cipher.getAuthTag();

    // Định dạng dữ liệu: IV:AUTH_TAG:ENCRYPTED_DATA
    return [
        iv.toString('hex'),
        authTag.toString('hex'),
        encrypted.toString('hex'),
    ].join(':');
}

/**
 * Giải mã API Key khi cần sử dụng để gọi dịch vụ AI
 */
export function decryptKey(encryptedText: string): string {
    // Tách dữ liệu đã mã hóa thành 3 phần
    const parts = encryptedText.split(':');

    if (parts.length !== 3) {
        throw new Error('Định dạng khóa đã mã hóa không hợp lệ.');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;

    // Kiểm tra định dạng và độ dài của từng thành phần
    if (
        !/^[0-9a-fA-F]{24}$/.test(ivHex) ||
        !/^[0-9a-fA-F]{32}$/.test(authTagHex) ||
        !/^(?:[0-9a-fA-F]{2})*$/.test(encryptedHex)
    ) {
        throw new Error('Dữ liệu mã hóa không hợp lệ.');
    }

    // Chuyển các chuỗi hex về dạng Buffer
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    // Khởi tạo bộ giải mã AES-256-GCM
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        getSecretKey(),
        iv,
        { authTagLength: AUTH_TAG_LENGTH }
    );

    // Thiết lập mã xác thực để kiểm tra tính toàn vẹn dữ liệu
    decipher.setAuthTag(authTag);

    // Tiến hành giải mã
    // Nếu dữ liệu bị chỉnh sửa hoặc mã xác thực không hợp lệ,
    // decipher.final() sẽ phát sinh lỗi
    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]);

    return decrypted.toString('utf8');
}
