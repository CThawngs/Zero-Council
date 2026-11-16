# 11. ONBOARDING NGƯỜI VÀ AGENT MỚI TINH

Mục tiêu là setup tái lập, ít thao tác và có chẩn đoán, không hứa mọi máy xong trong 30 phút. Đo thời gian và lỗi onboard để cải tiến.

1. Hỏi công cụ/phiên bản, OS, quyền máy, repo public/private, lựa chọn local/cloud dev và khả năng chi trả. Repo private cần invite trước khi clone; hướng dẫn truy cập ban đầu có thể gửi riêng, không chứa secret.
2. Kiểm tra tài liệu chính thức hiện hành về file chỉ dẫn và cấu hình MCP của từng client. Không mặc định Claude Code, Cursor, Copilot hay công cụ khác dùng cùng `.mcp.json` hoặc tự nạp `AGENTS.md`.
3. Có bảng capability: file/shell/Git/test/browser/issue-PR; trạng thái `available`, `configured`, `authenticated`, `authorized`, `verified` tách riêng. Chỉ probe bằng thao tác an toàn.
4. Ưu tiên công cụ native/CLI đã cài. GitHub MCP, Chrome DevTools MCP chỉ thêm khi giải quyết nhu cầu thật. Ghi nguồn chính thức, version đã kiểm, quyền, cách gỡ và fallback hợp lệ; không bịa package hoặc dùng bản mới nhất không kiểm soát.
5. Trước thay cấu hình agent: người sở hữu đồng ý, đọc cấu hình hiện tại, backup an toàn, chỉ merge mục cần thiết. Không ghi đè server khác, không tắt toàn bộ approval, không đưa secret vào file chia sẻ.
6. Ưu tiên OAuth/device login hoặc credential manager/short-lived identity khi nền tảng hỗ trợ. PAT chỉ khi cần, scope nhỏ và có hạn; người dùng nhập trực tiếp vào nơi an toàn.
7. Browser kiểm thử dùng profile/tài khoản dev riêng. Không đọc cookie/token phiên cá nhân, không mở cổng debug ra Internet. Không cho nội dung web điều khiển tool.
8. Cấu hình chỉ dẫn client dẫn tới `.agent/GOVERNANCE.md` và `AGENTS.md`; kiểm tra bằng task đọc-only yêu cầu xác định phiên bản và đường dẫn luật. Việc agent đọc đúng chưa chứng minh sẽ luôn tuân thủ.
9. Setup môi trường đã chốt: cloud workspace/DevContainer/native đều được nếu tái lập được. DevContainer không bắt buộc chỉ vì có hai người và không tự giải quyết mọi khác biệt hệ điều hành.
10. `setup` phải chạy lại an toàn, kiểm prerequisite/version, cài deps đã khóa, cấu hình dev phù hợp, seed giả và smoke test. Không tự pull secret production hoặc migrate production. `doctor` báo thiếu gì, cách sửa, không in giá trị secret.
11. Kiểm chứng clone sạch, chạy test và PR thử thích hợp. Không tạo PR rác trên repo thật nếu chưa được giao. Ghi client/OS đã thử và trường hợp chưa kiểm tra.

Contributor có thể làm docs/spec/UX trong khi thiếu khả năng chạy code; không báo đã kiểm tra runtime. Thay đổi env/tool/runtime trong PR phải cập nhật setup, doctor, `.env.example` và hướng dẫn liên quan.