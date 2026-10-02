## Supabase cần 3 mục:
+ Client.ts: truy cập Supabase từ phía browser
+ Server.ts: truy cập Supabase từ phía server
+ Proxy: quản lý Auth tokens giữa 2 phía

## Workflow cho Authentication:

User register -> user login bằng pass vừa tạo -> vào dashboard. user quên pass -> nhập email để gửi code rồi nhập code để verify tạo pass mới -> quay lại login để login bằng pass mới
email chắc dùng của resend

trường hợp đặc biệt:
- Nếu email trùng với email của tài khoản Google -> merge (hợp nhất) lại thành 1 account => tính thành 1 account duy nhất vì trùng email.
- Còn nếu email không trùng với email của tài khoản Google -> được tính là 1 account độc lập (không liên quan).

trong trường hợp user click vào Google để đăng ký account -> vào dashboard bắt buộc phải cho tạo password ngay lập tức -> rồi mới mở dashboard như bình thường

- trường hợp 1: A đăng ký account bằng Google -> tạo account thành công -> buộc phải tạo password -> truy cập vào dashboad. Lần sau có đăng nhập bằng tay (không thông qua Google) -> hệ thống verify email và password như bình thường -> truy cập vào dashboard.
- trường hợp 2: B đăng ký account bằng tay -> tạo account thành công -> truy cập vào dashboard -> lần sau đăng nhập bằng Google -> hệ thống verify và merge vào account đã tạo trước đó (vì trùng email) -> mọi lịch sử chat, mọi data của account đã tạo trước đó đều hiển thị như bình thường vì đã merge

## TODO
- [X] Init Supabase
- [X] Tạo Clients
- [ ] Gắn Đăng ký qua Email
- [ ] Gắn Đăng nhập qua Email
- [ ] Gắn Đăng ký qua Google, yêu cầu tạo mk riêng cho Zero-Council
- [ ] Gắn Đăng nhập qua Google
- [ ] Gộp tài khoản nếu trùng email và Google