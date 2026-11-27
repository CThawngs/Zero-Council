import type { Language } from '../types';

export interface GuideSection {
  title: string;
  /** Plain paragraphs. */
  body?: string[];
  /** Short list items, shown as bullets. */
  items?: { label: string; text: string }[];
}

export const GUIDE: Record<Language, GuideSection[]> = {
  vi: [
    {
      title: '1. Kết nối khóa API (BYOK)',
      body: [
        'Trước khi trò chuyện với bot, hãy vào mục Tích hợp (API Keys) để kết nối ít nhất một nhà cung cấp AI bằng khóa API của riêng bạn.',
        'Khóa API của bạn được kiểm tra trực tiếp trước khi lưu, mã hóa lưu trữ trên máy chủ bằng AES-256-GCM, hiển thị dạng che ký tự trên giao diện và chuyển tiếp qua máy chủ HTTPS/TLS — không bao giờ trả dạng văn bản gốc về trình duyệt.',
      ],
      items: [
        {
          label: '8 nhà cung cấp tích hợp sẵn',
          text: 'Anthropic (Claude), OpenAI, Google Gemini, Groq, xAI (Grok), OpenRouter, NVIDIA NIM và DeepSeek với địa chỉ gốc (Base URL) đã xác minh.',
        },
        {
          label: 'Nhà cung cấp tùy chỉnh',
          text: 'Kết nối mọi cổng tương thích OpenAI (/v1/chat/completions) hoặc Anthropic (/v1/messages) bằng Base URL, khóa API và mã mô hình của riêng bạn.',
        },
        {
          label: 'Chi phí minh bạch',
          text: 'Bạn thanh toán chi phí token trực tiếp cho nhà cung cấp AI đã chọn; Zero Council không thu thêm phụ phí trên token.',
        },
      ],
    },
    {
      title: '2. Tạo bot AI của bạn',
      body: [
        'Vào mục Bot của tôi và bấm "Tạo bot mới" để tạo các cố vấn AI chuyên biệt cho công việc hoặc quyết định của bạn.',
      ],
      items: [
        {
          label: 'Tên & hướng dẫn vai trò',
          text: 'Đặt tên dễ gọi khi @mention và mô tả rõ chuyên môn, góc nhìn phản biện hoặc phong cách trả lời của bot.',
        },
        {
          label: 'Chọn nhà cung cấp & mô hình',
          text: 'Gán một mô hình cụ thể từ nhà cung cấp đã kết nối. Mỗi bot luôn hiển thị rõ nhà cung cấp và mô hình đang dùng.',
        },
        {
          label: 'Hạn mức theo gói',
          text: 'Gói Free cho phép tối đa 2 bot/cố vấn hoạt động, gói Pro tối đa 4 và gói Ultra tối đa 8. Bạn có thể chỉnh sửa hoặc xóa bot bất cứ lúc nào.',
        },
      ],
    },
    {
      title: '3. Chat 1-1 (Solo) hoặc Hội đồng nhóm (Group Council)',
      items: [
        {
          label: 'Chat 1-1 với từng bot',
          text: 'Bấm vào một bot ở thanh bên để mở cuộc trò chuyện riêng. Bạn có thể tạo nhiều luồng hội thoại (threads) độc lập cho cùng một bot.',
        },
        {
          label: 'Tạo hội đồng nhóm',
          text: 'Bấm "Nhóm chat mới", đặt tên phòng và chọn từ 2 bot hoạt động trở lên (tối đa theo gói của bạn) để họp trong cùng một phòng.',
        },
        {
          label: 'Quản lý phòng & thư mục',
          text: 'Ghim phòng quan trọng, sắp xếp nhóm chat vào các thư mục phòng ban, đổi tên, xuất/nhập JSON hoặc xóa phòng khi không còn cần dùng.',
        },
      ],
    },
    {
      title: '4. Chế độ Độc lập vs Tranh luận & trao lượt @mention',
      body: [
        'Khi tạo hoặc chỉnh sửa phòng hội đồng, bạn chọn cách các bot phối hợp trả lời trong mỗi vòng họp:',
      ],
      items: [
        {
          label: 'Độc lập (Panel)',
          text: 'Mỗi bot lần lượt trả lời trực tiếp câu hỏi của bạn theo thứ tự thành viên trong phòng, giúp giữ góc nhìn rõ ràng trước khi tổng hợp.',
        },
        {
          label: 'Tranh luận (Round-robin)',
          text: 'Các bot đọc câu trả lời của nhau theo từng lượt, phản biện giả định, bổ sung rủi ro và đào sâu phương án.',
        },
        {
          label: 'Trao lượt với @mention và @all',
          text: 'Gõ @tên bot để mời đúng một bot trả lời tiếp, hoặc gõ @all để mời toàn bộ bot đang hoạt động trong phòng cùng lên tiếng.',
        },
        {
          label: 'Điều khiển lượt trả lời',
          text: 'Nhấn Enter để gửi, Shift+Enter để xuống dòng, bấm "Dừng" để ngắt lượt đang chạy, hoặc bấm "Thử lại lượt này" nếu một nhà cung cấp gặp lỗi mạng hay quá tải.',
        },
      ],
    },
    {
      title: '5. Đính kèm tệp, tìm kiếm web & Bảng nội dung',
      items: [
        {
          label: 'Đính kèm tài liệu & đa phương tiện',
          text: 'Đính kèm liên kết URL, tệp PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), tệp văn bản, hình ảnh hoặc khung hình video để các bot phân tích cùng câu hỏi.',
        },
        {
          label: 'Tìm kiếm web trực tiếp',
          text: 'Bật công tắc "Tìm kiếm web" khi cần bot tham chiếu thông tin mới từ các nguồn trực tuyến.',
        },
        {
          label: 'Bảng nội dung (Content Panel)',
          text: 'Mở rộng câu trả lời dài hoặc kỹ thuật sang Bảng nội dung với các chế độ Tự động, Markdown (MD), Mã nguồn (Code có đánh số dòng & nút sao chép), Sơ đồ cây tương tác (Tree) và văn bản Thô (Raw).',
        },
      ],
    },
    {
      title: '6. Tóm tắt phòng họp & Kết luận AI',
      items: [
        {
          label: 'Tóm tắt phòng họp (Recap)',
          text: 'Bấm "Tóm tắt" trong phòng chat để xem bản trích xuất nguyên văn lập trường cuối của từng bot, số lượt phát biểu, nguồn đính kèm và sao chép nhanh.',
        },
        {
          label: 'Kết luận AI (AI Conclusion)',
          text: 'Từ màn hình Tóm tắt, bấm "Mở kết luận" để AI Chủ tọa đọc toàn bộ nội dung cuộc họp, chỉ ra điểm đồng thuận, điểm bất đồng, khuyến nghị bước tiếp theo và 3 nhánh kịch bản Tốt / Bình thường / Xấu.',
        },
      ],
    },
    {
      title: '7. Dữ liệu, thanh toán & lưu ý quan trọng',
      items: [
        {
          label: 'Lưu trữ tài khoản',
          text: 'Bot và lịch sử hội thoại được lưu trên cơ sở dữ liệu tài khoản của bạn cho đến khi bạn xóa. Tránh dán mật khẩu, số thẻ ngân hàng hay bí mật nhạy cảm vào nội dung chat.',
        },
        {
          label: 'Gói 30 ngày trả một lần',
          text: 'Các gói Pro và Ultra thanh toán một lần bằng VNĐ qua PayOS VietQR, không tự động gia hạn. Hết 1 tháng (~30 ngày), tài khoản tự về gói Free và giữ nguyên dữ liệu của bạn.',
        },
        {
          label: 'Không phải tư vấn chuyên môn',
          text: 'Phản hồi của hội đồng là góc nhìn có cấu trúc hỗ trợ tư duy, không phải tư vấn pháp lý, y tế hay tài chính. Bạn luôn tự kiểm chứng và chịu trách nhiệm cho quyết định cuối cùng.',
        },
      ],
    },
  ],
  en: [
    {
      title: '1. Connect your API key (BYOK)',
      body: [
        'Before chatting with a bot, open Integrations (API Keys) and connect at least one AI provider using your own API key.',
        'Every key is verified live before saving, encrypted at rest on our server with AES-256-GCM, shown only masked in the UI, and proxied over HTTPS/TLS — plaintext keys are never returned to your browser.',
      ],
      items: [
        {
          label: '8 built-in verified providers',
          text: 'Anthropic (Claude), OpenAI, Google Gemini, Groq, xAI (Grok), OpenRouter, NVIDIA NIM, and DeepSeek with locked canonical Base URLs.',
        },
        {
          label: 'Custom providers',
          text: 'Connect any OpenAI-compatible (/v1/chat/completions) or Anthropic-compatible (/v1/messages) gateway with your own Base URL, API key, and model ID.',
        },
        {
          label: 'Direct provider billing',
          text: 'You pay token usage directly to your chosen AI provider with zero markup from Zero Council.',
        },
      ],
    },
    {
      title: '2. Create your AI bots',
      body: [
        'Open My bots and click "New bot" to configure specialized AI advisors for your work or decisions.',
      ],
      items: [
        {
          label: 'Name & role instructions',
          text: 'Give each bot a memorable name for @mentions and write clear instructions describing its expertise, stance, and response style.',
        },
        {
          label: 'Provider & model',
          text: 'Pick a specific model from any connected provider. Every bot displays its exact provider and model ID.',
        },
        {
          label: 'Plan capacity',
          text: 'Free supports up to 2 active bots/advisors, Pro up to 4, and Ultra up to 8. You can edit or delete bots at any time.',
        },
      ],
    },
    {
      title: '3. Solo chat or Group Council',
      items: [
        {
          label: '1-on-1 Solo chat',
          text: 'Click any bot in the sidebar to start a private conversation. You can create multiple independent threads under the same bot.',
        },
        {
          label: 'Group Council',
          text: 'Click "New group chat", name the room, and select 2 or more active bots (up to your plan limit) to deliberate together in one room.',
        },
        {
          label: 'Organize rooms & departments',
          text: 'Pin priority rooms, group rooms into department folders, rename or edit members, export/import JSON, or delete rooms when finished.',
        },
      ],
    },
    {
      title: '4. Independent vs Debate & @mention handoffs',
      body: [
        'When creating or editing a group room, choose how your bots take turns:',
      ],
      items: [
        {
          label: 'Independent (Panel)',
          text: 'Each bot answers your prompt in roster order, keeping each model’s perspective clear before the final wrap-up.',
        },
        {
          label: 'Debate (Round-robin)',
          text: 'Bots read each other’s previous turns, challenge assumptions, surface risks, and refine options step by step.',
        },
        {
          label: '@mention and @all handoffs',
          text: 'Type @bot name to invite a specific bot to speak next, or @all to ask every active bot in the room to weigh in.',
        },
        {
          label: 'Turn controls',
          text: 'Press Enter to send, Shift+Enter for a new line, click "Stop" to cancel a turn in progress, or click "Retry turn" if a provider times out or returns a transient error.',
        },
      ],
    },
    {
      title: '5. Attachments, Web Search & Live Content Panel',
      items: [
        {
          label: 'Files, links & media',
          text: 'Attach web URLs, PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), plain text, images, or video keyframes so bots can read them alongside your prompt.',
        },
        {
          label: 'Live Web Search',
          text: 'Toggle "Search the web" when you want bots to ground answers in current online sources.',
        },
        {
          label: 'Live Content Panel',
          text: 'Expand rich or technical replies into the Content Panel with Auto, Markdown (MD), Code (line numbers & copy button), interactive Tree, and Raw views.',
        },
      ],
    },
    {
      title: '6. Meeting Recap & AI Conclusion',
      items: [
        {
          label: 'Meeting Recap (Room Summary)',
          text: 'Click "Recap" inside a room for an extractive summary of each bot’s latest position, turn counts, and pinned sources — ready to copy in one click.',
        },
        {
          label: 'AI Conclusion',
          text: 'From the Recap screen, click "Open the conclusion" to synthesize the full room transcript into a Chair verdict, key dissent, recommended next step, and Good / Normal / Bad scenario branches.',
        },
      ],
    },
    {
      title: '7. Data, billing & good to know',
      items: [
        {
          label: 'Account persistence',
          text: 'Your bots and conversations remain saved in your account database until you delete them. Keep passwords, card numbers, and confidential secrets out of prompts.',
        },
        {
          label: 'One-time 30-day passes',
          text: 'Pro and Ultra are one-time 30-day (1-month) passes paid in VND via PayOS VietQR with no auto-renewal. When a pass expires, your account reverts to Free while keeping your saved data.',
        },
        {
          label: 'Not professional advice',
          text: 'Council output is a structured second opinion generated by AI models — not legal, medical, or financial advice. Always verify critical facts; the final decision is yours.',
        },
      ],
    },
  ],
};
