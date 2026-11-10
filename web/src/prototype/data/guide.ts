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
      title: '1. Bắt đầu nhanh',
      body: [
        'Ở trang tạo phòng, viết quyết định của bạn, chọn khung phân tích, cách cố vấn nói chuyện và những cố vấn sẽ ngồi họp, rồi bấm "Bắt đầu hội đồng". Bạn sẽ vào thẳng khung chat và các cố vấn bắt đầu trả lời.',
      ],
    },
    {
      title: '2. Viết câu hỏi cho tốt',
      items: [
        { label: 'Nêu rõ lựa chọn', text: 'Bạn đang phân vân giữa những phương án nào, hoặc đang cân nhắc làm hay không làm điều gì.' },
        { label: 'Cho bối cảnh', text: 'Thời gian, ngân sách, ràng buộc, điều bạn quan tâm nhất. Càng cụ thể, lời khuyên càng sát.' },
        { label: 'Đừng đưa bí mật', text: 'Tránh mật khẩu, số thẻ hay thông tin nhạy cảm vào câu hỏi.' },
      ],
    },
    {
      title: '3. Khung phân tích',
      body: ['Khung quyết định cách hội đồng nhìn vấn đề của bạn.'],
      items: [
        { label: 'Kịch bản Tốt / Bình thường / Xấu', text: 'Xem điều gì xảy ra trong ba trường hợp, và nên làm gì ở mỗi trường hợp.' },
        { label: 'Sáu chiếc mũ tư duy', text: 'Nhìn cùng một vấn đề từ nhiều góc: dữ kiện, cảm xúc, rủi ro, lợi ích, sáng tạo và quản lý.' },
        { label: 'Ma trận quyết định', text: 'Chấm điểm các phương án theo những tiêu chí bạn coi trọng để so sánh.' },
      ],
    },
    {
      title: '4. Chọn cố vấn',
      body: [
        'Mỗi cố vấn có một lập trường riêng. Bấm vào thẻ để chọn hoặc bỏ chọn. Số cố vấn tối đa phụ thuộc vào gói của bạn.',
        'Muốn tạo hoặc chỉnh cố vấn, bấm "Sửa cố vấn" ở trang tạo phòng hoặc vào mục Cố vấn ở thanh bên.',
      ],
    },
    {
      title: '5. Cách cố vấn nói chuyện với nhau',
      items: [
        { label: 'Độc lập', text: 'Mỗi cố vấn tự trả lời từ câu hỏi của bạn, không ai thấy câu trả lời của nhau.' },
        { label: 'Tranh luận', text: 'Mỗi cố vấn trả lời người đứng trước và phản biện khi có thể.' },
        { label: 'Nối tiếp', text: 'Mỗi cố vấn xây tiếp trên câu trả lời trước đó thay vì trả lời lại từ đầu.' },
      ],
      body: ['Hiện Tranh luận và Nối tiếp đều chạy theo kiểu các cố vấn lần lượt nghe nhau trong phòng chat.'],
    },
    {
      title: '6. Trong phòng chat',
      items: [
        { label: 'Trao lượt', text: 'Gõ @tên cố vấn để mời người đó nói tiếp. Bấm tên cố vấn phía trên ô nhập để chèn nhanh.' },
        { label: 'Đính kèm', text: 'Bạn có thể đính kèm liên kết, tệp hoặc ảnh để cố vấn đọc cùng câu hỏi.' },
        { label: 'Gửi tin', text: 'Enter để gửi, Shift+Enter để xuống dòng.' },
        { label: 'Dừng', text: 'Bấm "Dừng" để ngắt lượt đang chạy.' },
        { label: 'Tóm tắt', text: 'Bấm "Tóm tắt" để kết thúc họp và xem lại những gì đã nói.' },
      ],
    },
    {
      title: '7. Lưu ý',
      body: [
        'Khuyến nghị của hội đồng là ý kiến thứ hai có cấu trúc, không phải tư vấn tài chính, y tế hay pháp lý. Quyết định cuối cùng luôn thuộc về bạn.',
      ],
    },
  ],
  en: [
    {
      title: '1. Quick start',
      body: [
        'On the new council page, write your decision, pick a framework, how advisors talk and who sits on the council, then press "Start council". You go straight into the chat room and the advisors begin answering.',
      ],
    },
    {
      title: '2. Writing a good question',
      items: [
        { label: 'State the choice', text: 'Which options you are torn between, or what you are thinking of doing or not doing.' },
        { label: 'Give context', text: 'Time, budget, constraints, what matters most to you. The more specific, the sharper the advice.' },
        { label: 'Keep secrets out', text: 'Avoid passwords, card numbers or sensitive data in the question.' },
      ],
    },
    {
      title: '3. Frameworks',
      body: ['The framework decides how the council looks at your problem.'],
      items: [
        { label: 'Good / Normal / Bad scenarios', text: 'See what happens in three cases and what to do in each.' },
        { label: 'Six Thinking Hats', text: 'Look at one problem from several angles: facts, feelings, risks, benefits, creativity and process.' },
        { label: 'Decision matrix', text: 'Score the options against the criteria you care about to compare them.' },
      ],
    },
    {
      title: '4. Choosing advisors',
      body: [
        'Each advisor has their own stance. Click a card to add or remove them. The maximum number of advisors depends on your plan.',
        'To create or edit advisors, use "Edit advisors" on the new council page or the Advisors item in the sidebar.',
      ],
    },
    {
      title: '5. How advisors talk to each other',
      items: [
        { label: 'Independent', text: 'Each advisor answers alone from your question; none see the others.' },
        { label: 'Debate', text: 'Each advisor answers the one before and pushes back where they can.' },
        { label: 'Chain', text: 'Each advisor builds on the previous answer instead of starting over.' },
      ],
      body: ['Right now Debate and Chain both run as advisors taking turns and hearing each other in the chat room.'],
    },
    {
      title: '6. In the chat room',
      items: [
        { label: 'Hand over the floor', text: 'Type @advisor name to invite them to speak next. Click an advisor name above the input to insert it.' },
        { label: 'Attach', text: 'Attach a link, file or image so the advisors can read it along with your question.' },
        { label: 'Send', text: 'Enter to send, Shift+Enter for a new line.' },
        { label: 'Stop', text: 'Press "Stop" to interrupt the round in progress.' },
        { label: 'Recap', text: 'Press "Recap" to end the meeting and review what was said.' },
      ],
    },
    {
      title: '7. Good to know',
      body: [
        'The council’s recommendation is a structured second opinion, not financial, medical or legal advice. The final decision is always yours.',
      ],
    },
  ],
};
