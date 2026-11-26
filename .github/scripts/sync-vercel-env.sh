#!/usr/bin/env bash
# Đẩy biến môi trường từ GitHub Secrets sang Vercel.
#
# Tách khỏi workflow để test được: tests/sync-vercel-env.test.mjs chạy chính file này với
# một HTTP server stub. Chỉ còn phần "Vercel thật trả gì" là chưa chạy.
#
# Input: đọc từ env (workflow ánh xạ từ GitHub secrets). Output: HTTP status, không in giá trị.
set -euo pipefail

# Test seam. Đổi chỉ khi test; production để mặc định.
api="${VERCEL_API_BASE:-https://api.vercel.com}"

# Kiểm tra 8 biến bắt buộc bằng tham chiếu trực tiếp, KHÔNG dùng `${!name}` hay printenv.
# Cả hai từng báo sai trong lúc phát triển trên Git Bash/Windows: biến đã export rõ ràng
# vẫn bị coi là unset, và kết quả đổi giữa các lần chạy. Runner GitHub chạy Linux nên
# không dính, nhưng một job đang cầm secret thì không được để cách kiểm tra mơ hồ.
missing=0
for v in "${VERCEL_TOKEN-}" "${VERCEL_PROJECT-}" "${PAYOS_CLIENT_ID-}" "${PAYOS_API_KEY-}" \
         "${PAYOS_CHECKSUM_KEY-}" "${SUPABASE_URL-}" "${SUPABASE_SERVICE_ROLE_KEY-}" \
         "${ZC_PROVIDER_KEY_SECRET-}"; do
  if [ -z "$v" ]; then
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  echo "::error::Thiếu biến bắt buộc trong GitHub secrets. Dừng, không đẩy nửa vời." >&2
  echo "::error::Cần đủ 8: VERCEL_TOKEN, VERCEL_PROJECT, PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ZC_PROVIDER_KEY_SECRET" >&2
  exit 1
fi

# File tạm chứa secret — trap dọn kể cả khi job chết giữa chừng.
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Token nằm trong config file, không nằm trên argv (ps không thấy được).
{
  echo 'header = "Authorization: Bearer '"${VERCEL_TOKEN}"'"'
  echo 'header = "Content-Type: application/json"'
  echo 'silent'
  echo 'show-error'
} > "$work/auth.conf"

# Một request cho toàn bộ biến cấu hình. type=encrypted: không đọc lại được trong UI Vercel.
# target=production: preview/dev không nhận, tránh lọt secret sang môi trường khác.
# Node thay cho jq: có sẵn trên runner GitHub và trên máy dev, không cài thêm gì.
pushed_keys="$(node - "$work/payload.json" <<'NODE'
const fs = require('node:fs');
const outFile = process.argv[2];

const requiredKeys = [
  'PAYOS_CLIENT_ID',
  'PAYOS_API_KEY',
  'PAYOS_CHECKSUM_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ZC_PROVIDER_KEY_SECRET',
];

const optionalKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_ANALYTICS_WEBSITE_ID',
  'FOUNDER_EMAILS',
];

const keys = [
  ...requiredKeys,
  ...optionalKeys.filter((key) => typeof process.env[key] === 'string' && process.env[key].trim().length > 0),
];

const payload = keys.map((key) => ({
  key,
  value: process.env[key],
  type: 'encrypted',
  target: ['production'],
}));

fs.writeFileSync(outFile, JSON.stringify(payload));
process.stdout.write(keys.join(', '));
NODE
)"

url="${api}/v10/projects/${VERCEL_PROJECT}/env?upsert=true"
# Project thuộc team thì bắt buộc có teamId, nếu không sẽ 404.
if [ -n "${VERCEL_TEAM:-}" ]; then
  url="${url}&teamId=${VERCEL_TEAM}"
fi

code="$(curl --config "$work/auth.conf" -o "$work/resp.json" -w '%{http_code}' \
  -X POST "$url" --data-binary "@$work/payload.json")"

if [ "$code" != "200" ] && [ "$code" != "201" ]; then
  # In body lỗi (không chứa giá trị vừa đẩy lên) — lý do 400/403 mà không có body thì không đoán được.
  echo "Vercel trả HTTP $code" >&2
  head -c 500 "$work/resp.json" >&2
  exit 1
fi

echo "Đã đẩy biến (HTTP $code): ${pushed_keys}"
echo "Còn việc: Vercel chụp biến theo từng deployment — phải redeploy một lần mới có hiệu lực."
