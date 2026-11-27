/**
 * Vietnamese legal policy documents rendered by `LegalView`.
 *
 * Mirrors `legalEn` 1:1 in structure and section count, enforced by the i18n parity test suite.
 */

export const legalVi = {
  terms: {
    title: 'Điều khoản dịch vụ',
    draft: false,
    intro: 'Các Điều khoản dịch vụ này điều chỉnh việc bạn truy cập và sử dụng Zero Council. Khi tạo tài khoản hoặc sử dụng không gian làm việc, bạn đồng ý tuân thủ các điều khoản dưới đây.',
    sections: [
      {
        heading: '1. Phạm vi dịch vụ của Zero Council',
        body: [
          'Zero Council là không gian làm việc AI đa tác tử theo mô hình tự mang khóa API (BYOK). Bạn kết nối khóa API của riêng mình từ các nhà cung cấp AI được hỗ trợ, tạo bot AI tùy chỉnh và chạy hội thoại 1-1 hoặc hội đồng nhóm nhiều bot kèm tóm tắt cuộc họp và kết luận do AI tổng hợp.',
          'Zero Council cung cấp phần mềm không gian làm việc, lưu trữ dữ liệu tài khoản và lớp trung gian gọi API an toàn. Đây là công cụ hỗ trợ tư duy và ra quyết định, không phải dịch vụ tư vấn chuyên môn.',
        ],
      },
      {
        heading: '2. Tài khoản và trách nhiệm sử dụng',
        body: [
          'Bạn cần sử dụng địa chỉ email hợp lệ để đăng ký tài khoản và tự chịu trách nhiệm bảo mật thông tin đăng nhập cũng như mọi hoạt động phát sinh từ tài khoản của mình.',
          'Không chia sẻ tài khoản trái phép và không tìm cách truy cập dữ liệu không gian làm việc của người dùng khác.',
        ],
      },
      {
        heading: '3. Tự mang khóa API (BYOK) và nhà cung cấp AI bên thứ ba',
        body: [
          'Phản hồi của các bot được tạo bởi nhà cung cấp AI bên thứ ba mà bạn kết nối (như Anthropic, OpenAI, Google Gemini, Groq, xAI, OpenRouter, NVIDIA NIM, DeepSeek hoặc cổng tương thích OpenAI/Anthropic tùy chỉnh của riêng bạn).',
          'Bạn chịu trách nhiệm duy trì tài khoản hợp lệ với các nhà cung cấp đó, tuân thủ điều khoản của họ và thanh toán trực tiếp mọi chi phí token/sử dụng mô hình cho họ. Zero Council không thu thêm phụ phí trên lượng token của bạn.',
        ],
      },
      {
        heading: '4. Gói dịch vụ, gói 30 ngày trả một lần và giới hạn số lượng',
        body: [
          'Zero Council có gói Miễn phí (Free) cùng hai gói trả phí Pro và Ultra giúp mở rộng số lượng bot hoạt động và số cố vấn cùng tham gia trong phòng hội đồng theo bảng Giá công bố.',
          'Các gói trả phí được bán theo hình thức gói 30 ngày (1 tháng) trả một lần bằng Đồng Việt Nam (VNĐ) qua PayOS VietQR và không tự động gia hạn. Khi hết hạn, tài khoản sẽ tự động trở về gói Free; các bot vượt hạn mức gói Free được tạm khóa chứ không bị xóa và sẽ hoạt động lại nếu bạn mua gói mới.',
        ],
      },
      {
        heading: '5. Nội dung của bạn và đầu ra từ AI',
        body: [
          'Bạn giữ quyền sở hữu đối với câu hỏi, tệp đính kèm, hướng dẫn bot và nội dung hội thoại bạn tạo trên Zero Council. Bạn chỉ cấp cho Zero Council quyền kỹ thuật cần thiết để lưu trữ dữ liệu trong tài khoản của bạn, chuyển tiếp yêu cầu tới nhà cung cấp AI bạn chọn và hiển thị kết quả cho bạn.',
          'Mô hình AI có thể tạo ra thông tin thiếu chính xác hoặc mâu thuẫn. Bạn tự chịu trách nhiệm kiểm chứng mọi nội dung trước khi sử dụng hoặc ra quyết định.',
        ],
      },
      {
        heading: '6. Sử dụng hợp lệ và tạm ngưng tài khoản',
        body: [
          'Bạn đồng ý tuân thủ Chính sách sử dụng hợp lệ. Chúng tôi có quyền hạn chế hoặc chấm dứt quyền truy cập nếu tài khoản lạm dụng hệ thống, tìm cách vượt qua giới hạn bảo mật/gói dịch vụ hoặc vi phạm pháp luật hiện hành.',
        ],
      },
      {
        heading: '7. Khả năng sẵn sàng và giới hạn trách nhiệm',
        body: [
          'Zero Council được cung cấp theo nguyên trạng ("as is") và theo khả năng sẵn sàng ("as available"). Chúng tôi không cam kết hệ thống hoạt động không gián đoạn và không chịu trách nhiệm đối với sự cố, giới hạn tốc độ, thay đổi giá hoặc sai sót đầu ra từ nhà cung cấp AI bên thứ ba hay cổng thanh toán.',
          'Trong phạm vi tối đa pháp luật cho phép, tổng trách nhiệm của Zero Council đối với mọi khiếu nại liên quan đến dịch vụ không vượt quá số tiền bạn đã thanh toán cho Zero Council trong vòng 30 ngày ngay trước thời điểm phát sinh khiếu nại.',
        ],
      },
      {
        heading: '8. Cập nhật và liên hệ',
        body: [
          'Chúng tôi có thể cập nhật các điều khoản này khi sản phẩm phát triển; phiên bản mới nhất luôn được đăng tải tại trang này. Mọi câu hỏi xin gửi về nguyenchithang2804@gmail.com.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Chính sách quyền riêng tư',
    draft: false,
    intro: 'Chính sách quyền riêng tư này giải thích Zero Council lưu trữ dữ liệu gì, bảo vệ khóa API của bạn ra sao, khi nào dữ liệu được gửi tới nhà cung cấp AI bên thứ ba và cách bạn có thể xóa dữ liệu.',
    sections: [
      {
        heading: '1. Dữ liệu được lưu trên tài khoản của bạn',
        body: [
          'Khi bạn sử dụng Zero Council, chúng tôi lưu dữ liệu cần thiết để vận hành không gian làm việc trong cơ sở dữ liệu Supabase Postgres: địa chỉ email, tên hiển thị, thông tin xác thực tài khoản, cấu hình bot tùy chỉnh, các luồng chat 1-1, lịch sử hội đồng nhóm, cài đặt phòng và lịch sử đơn hàng/gói dịch vụ.',
          'Dữ liệu không gian làm việc được lưu giữ trên tài khoản của bạn cho đến khi bạn chủ động xóa từng bot, cuộc hội thoại hoặc yêu cầu xóa toàn bộ tài khoản. Dữ liệu hội thoại và hồ sơ được truyền qua HTTPS/TLS và giới hạn phạm vi truy cập theo tài khoản đã đăng nhập, không sử dụng mã hóa đầu-cuối (end-to-end encryption).',
        ],
      },
      {
        heading: '2. Cách bảo vệ khóa API (BYOK) của bạn',
        body: [
          'Khi bạn lưu khóa API của nhà cung cấp AI, máy chủ của chúng tôi mã hóa khóa ở trạng thái lưu trữ bằng thuật toán AES-256-GCM với vector khởi tạo (IV) ngẫu nhiên và thẻ xác thực riêng trước khi ghi vào cơ sở dữ liệu.',
          'Khóa đã lưu chỉ hiển thị dạng che ký tự trên giao diện, không bao giờ được gửi trả dạng văn bản gốc về trình duyệt và không ghi vào nhật ký hệ thống. Khi bạn xác minh khóa, kiểm tra mô hình hoặc gửi tin nhắn, các tuyến máy chủ (/api/providers/verify, /api/providers/test và /api/providers/chat) chỉ giải mã khóa trong bộ nhớ để chuyển tiếp yêu cầu qua HTTPS/TLS tới đúng nhà cung cấp AI bạn chọn.',
        ],
      },
      {
        heading: '3. Dữ liệu gửi tới dịch vụ bên thứ ba',
        body: [
          'Nhà cung cấp AI: Câu hỏi, hướng dẫn hệ thống, ngữ cảnh hội thoại và nội dung tệp/ảnh đính kèm được chuyển tiếp tới nhà cung cấp AI bạn đã cấu hình (Anthropic, OpenAI, Google Gemini, Groq, xAI, OpenRouter, NVIDIA NIM, DeepSeek hoặc cổng tùy chỉnh của bạn). Nhà cung cấp đó xử lý dữ liệu theo chính sách quyền riêng tư và lưu trữ riêng của họ.',
          'Tìm kiếm web và liên kết đính kèm: Khi bạn bật tìm kiếm web trực tiếp hoặc đính kèm URL, truy vấn hoặc đường dẫn đó được gửi đi để lấy nội dung phục vụ phân tích trong phòng họp.',
          'Thanh toán: Khi bạn mua gói trả phí, thông tin đơn hàng (mã đơn, số tiền VNĐ và trạng thái thanh toán) được trao đổi với PayOS để tạo mã VietQR và xác nhận giao dịch. Zero Council không tiếp nhận hay lưu mật khẩu ngân hàng hoặc số thẻ của bạn.',
        ],
      },
      {
        heading: '4. Cookie và phân tích tùy chọn',
        body: [
          'Chúng tôi sử dụng cookie và bộ nhớ trình duyệt thiết yếu cho phiên đăng nhập, ngôn ngữ và giao diện sáng/tối. Tập lệnh phân tích truy cập tùy chọn (Umami) chỉ được tải khi bạn chủ động đồng ý trên thông báo cookie. Xem thêm tại Chính sách Cookie.',
        ],
      },
      {
        heading: '5. Thời gian lưu trữ và quyền xóa dữ liệu',
        body: [
          'Bạn có thể ngắt kết nối khóa API, xóa từng bot hoặc xóa từng cuộc hội thoại ngay trong không gian làm việc bất cứ lúc nào. Khi ngắt kết nối khóa API, bản ghi mã hóa của khóa đó bị xóa ngay khỏi cơ sở dữ liệu.',
          'Để yêu cầu xóa toàn bộ tài khoản và dữ liệu không gian làm việc liên quan (trừ thông tin đối soát giao dịch tối thiểu nếu cần), hãy gửi email từ địa chỉ đăng ký tới nguyenchithang2804@gmail.com.',
        ],
      },
      {
        heading: '6. Thông tin nhạy cảm',
        body: [
          'Vui lòng không dán mật khẩu, số thẻ ngân hàng, giấy tờ tùy thân hoặc bí mật tuyệt mật vào câu hỏi hay tệp đính kèm, vì nội dung hội thoại được lưu trong lịch sử tài khoản và chuyển tiếp tới nhà cung cấp AI bên thứ ba mà bạn chọn.',
        ],
      },
      {
        heading: '7. Liên hệ',
        body: [
          'Mọi câu hỏi về quyền riêng tư, truy cập dữ liệu hoặc yêu cầu xóa tài khoản xin gửi về nguyenchithang2804@gmail.com.',
        ],
      },
    ],
  },
  refund: {
    title: 'Chính sách hoàn tiền',
    draft: false,
    intro: 'Các gói trả phí trên Zero Council là gói 30 ngày (1 tháng) trả một lần bằng Đồng Việt Nam (VNĐ) qua PayOS VietQR. Chính sách này quy định rõ cách tính hạn dùng và điều kiện hoàn tiền.',
    sections: [
      {
        heading: '1. Gói trả một lần — không tự động gia hạn',
        body: [
          'Mỗi lần thanh toán gói Pro hoặc Ultra cấp 1 tháng (~30 ngày) hạn mức bot và cố vấn mở rộng. Chúng tôi không lưu thẻ ngân hàng và không tự động trừ tiền gia hạn.',
          'Nếu bạn mua thêm gói khi gói hiện tại còn hạn, thời hạn mới sẽ được cộng nối tiếp từ ngày hết hạn hiện tại. Khi hết hạn mà không mua mới, tài khoản tự động trở về gói Free.',
        ],
      },
      {
        heading: '2. Đơn vị tiền tệ và hiển thị giá',
        body: [
          'Mọi gói trả phí đều được thanh toán bằng Đồng Việt Nam (VNĐ) qua PayOS VietQR. Giá USD hiển thị ở giao diện tiếng Anh chỉ mang tính tham khảo; ngân hàng của bạn luôn xử lý đúng số tiền VNĐ hiển thị tại màn hình thanh toán.',
        ],
      },
      {
        heading: '3. Các trường hợp được hoàn tiền',
        body: [
          'Thanh toán trùng lặp ngoài ý muốn cho cùng một đơn hàng hoặc cùng một chu kỳ gói.',
          'Lỗi kỹ thuật đã xác minh khiến PayOS đã trừ tiền nhưng gói dịch vụ không được kích hoạt và không thể khắc phục kịp thời.',
          'Yêu cầu hoàn tiền thiện chí gửi trong vòng 7 ngày kể từ lúc thanh toán nếu hạn mức gói trả phí chưa được sử dụng đáng kể.',
        ],
      },
      {
        heading: '4. Các khoản không thuộc phạm vi hoàn tiền',
        body: [
          'Chi phí token phát sinh trên khóa API của các nhà cung cấp AI bên thứ ba được bạn thanh toán trực tiếp cho họ và không thuộc phạm vi hoàn tiền của Zero Council.',
          'Các gói đã sử dụng phần lớn trong thời hạn hoặc tài khoản bị tạm ngưng do vi phạm Chính sách sử dụng hợp lệ sẽ không được hoàn tiền.',
        ],
      },
      {
        heading: '5. Cách yêu cầu hoàn tiền',
        body: [
          'Gửi email tới nguyenchithang2804@gmail.com kèm địa chỉ email tài khoản, mã đơn hàng PayOS trong mục Lịch sử thanh toán và lý do ngắn gọn. Khoản hoàn tiền được phê duyệt sẽ chuyển khoản lại bằng VNĐ.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Chính sách Cookie',
    draft: false,
    intro: 'Zero Council chỉ dùng một số cookie và bộ nhớ trình duyệt thiết yếu để duy trì đăng nhập và lưu tùy chọn giao diện, cùng tập lệnh phân tích tùy chọn khi bạn đồng ý.',
    sections: [
      {
        heading: '1. Cookie và bộ nhớ cục bộ thiết yếu',
        body: [
          'Cookie xác thực (do Supabase Auth quản lý) duy trì phiên đăng nhập và bảo vệ các tuyến tài khoản của bạn.',
          'Tùy chọn giao diện (như cookie ngôn ngữ zc-lang và chế độ sáng/tối) giúp ghi nhớ ngôn ngữ và giao diện giữa các lần truy cập.',
          'Trạng thái đồng ý cookie (khóa localStorage zc-analytics-consent) lưu lựa chọn chấp nhận hay từ chối phân tích để không hỏi lặp lại.',
        ],
      },
      {
        heading: '2. Phân tích truy cập tùy chọn',
        body: [
          'Chúng tôi không tải trình theo dõi quảng cáo hay pixel bám đuổi liên trang. Nếu bạn bấm "Chấp nhận phân tích" trên thông báo cookie, Zero Council có thể tải tập lệnh Umami nhằm đo lường lượt truy cập và mức độ sử dụng tính năng ở dạng tổng hợp.',
          'Nếu bạn chọn "Chỉ cần thiết", tập lệnh phân tích sẽ không bao giờ được tải.',
        ],
      },
      {
        heading: '3. Quản lý lựa chọn của bạn',
        body: [
          'Bạn có thể xóa cookie và dữ liệu cục bộ của trang bất cứ lúc nào trong cài đặt trình duyệt. Khi xóa bộ nhớ cục bộ, lựa chọn đồng ý phân tích sẽ được đặt lại và hiển thị lại ở lần truy cập tiếp theo.',
        ],
      },
      {
        heading: '4. Liên hệ',
        body: [
          'Mọi câu hỏi về cookie và lưu trữ trình duyệt xin gửi về nguyenchithang2804@gmail.com.',
        ],
      },
    ],
  },
  'acceptable-use': {
    title: 'Chính sách sử dụng hợp lệ',
    draft: false,
    intro: 'Chính sách sử dụng hợp lệ đặt ra các nguyên tắc cơ bản để bảo đảm Zero Council được sử dụng an toàn và có trách nhiệm.',
    sections: [
      {
        heading: '1. Hành vi bị nghiêm cấm',
        body: [
          'Không sử dụng Zero Council để vi phạm pháp luật, xâm phạm quyền sở hữu trí tuệ hoặc quyền riêng tư, tạo mã độc hay công cụ tấn công mạng, phát tán nội dung lừa đảo/quấy rối hoặc tiếp tay cho hành vi gây hại.',
          'Bạn đồng thời phải tuân thủ chính sách sử dụng của từng nhà cung cấp AI bên thứ ba mà bạn kết nối khóa API.',
        ],
      },
      {
        heading: '2. Toàn vẹn hệ thống và bảo mật',
        body: [
          'Không dò quét lỗ hổng, thu thập dữ liệu trái phép, gây quá tải hoặc tìm cách vượt qua cơ chế xác thực, giới hạn tốc độ, giới hạn gói dịch vụ, xác minh thanh toán hay tuyến trung gian nhà cung cấp (/api/providers/*).',
          'Không trỏ cổng nhà cung cấp tùy chỉnh tới địa chỉ mạng nội bộ, hạ tầng riêng tư hoặc dịch vụ bên thứ ba không được phép.',
        ],
      },
      {
        heading: '3. Trách nhiệm tài khoản',
        body: [
          'Không sử dụng khóa API bị đánh cắp, rò rỉ hoặc không được cấp phép, và không tự động hóa hành vi lạm dụng hàng loạt trên không gian làm việc.',
        ],
      },
      {
        heading: '4. Xử lý vi phạm và báo cáo',
        body: [
          'Chúng tôi có thể hạn chế, tạm khóa hoặc chấm dứt tài khoản vi phạm chính sách này. Để báo cáo hành vi lạm dụng hoặc sự cố bảo mật, hãy gửi email về nguyenchithang2804@gmail.com.',
        ],
      },
    ],
  },
  disclaimer: {
    title: 'Tuyên bố miễn trừ trách nhiệm',
    draft: false,
    intro: 'Zero Council giúp bạn đối chiếu góc nhìn từ nhiều mô hình AI trong cùng một không gian làm việc. Vui lòng đọc kỹ các giới hạn sau trước khi hành động dựa trên phản hồi AI.',
    sections: [
      {
        heading: '1. Không phải tư vấn chuyên môn',
        body: [
          'Phản hồi của các bot AI, tóm tắt phòng họp và kết luận AI được tạo bởi các mô hình ngôn ngữ lớn chỉ nhằm mục đích tham khảo và hỗ trợ tư duy. Nội dung này không phải là tư vấn pháp lý, tài chính, đầu tư, thuế, y tế hay bất kỳ tư vấn hành nghề có chứng chỉ nào.',
          'Hãy luôn tham khảo ý kiến chuyên gia có chuyên môn trước khi đưa ra quyết định quan trọng về pháp lý, tài chính hoặc sức khỏe.',
        ],
      },
      {
        heading: '2. Giới hạn về độ chính xác của mô hình',
        body: [
          'Mô hình AI có thể tạo ra thông tin sai lệch (hallucination), đọc thiếu ngữ cảnh tệp đính kèm, bỏ sót diễn biến mới hoặc đưa ra nhận định trái ngược nhau. Ngay cả khi bật tìm kiếm web hoặc đính kèm tài liệu, bạn vẫn cần tự kiểm chứng số liệu, trích dẫn và mã nguồn quan trọng trước khi sử dụng.',
        ],
      },
      {
        heading: '3. Mô hình và liên kết bên thứ ba',
        body: [
          'Zero Council không huấn luyện, vận hành hay kiểm soát các mô hình AI bên ngoài mà bạn kết nối qua BYOK, đồng thời không bảo chứng nội dung từ các trang web bên thứ ba được tải qua liên kết đính kèm hay tìm kiếm web.',
        ],
      },
      {
        heading: '4. Trách nhiệm quyết định cuối cùng',
        body: [
          'Mọi quyết định cuối cùng và hệ quả đi kèm hoàn toàn thuộc trách nhiệm của bạn.',
        ],
      },
    ],
  },
  contact: {
    title: 'Liên hệ',
    draft: false,
    intro: 'Cần hỗ trợ về tài khoản Zero Council, thiết lập khóa API (BYOK), thanh toán PayOS hoặc yêu cầu về dữ liệu cá nhân? Hãy liên hệ trực tiếp với chúng tôi qua email.',
    sections: [
      {
        heading: '1. Email hỗ trợ, quyền riêng tư và thanh toán',
        body: [
          'nguyenchithang2804@gmail.com',
          'Sử dụng địa chỉ này cho yêu cầu hỗ trợ sản phẩm, thắc mắc hóa đơn/hoàn tiền PayOS, báo cáo bảo mật và yêu cầu liên quan đến quyền riêng tư hoặc xóa tài khoản.',
        ],
      },
      {
        heading: '2. Thời gian phản hồi',
        body: [
          'Chúng tôi phản hồi trong thời gian sớm nhất có thể và ưu tiên xử lý các yêu cầu liên quan đến quyền riêng tư, bảo mật và xác nhận thanh toán.',
        ],
      },
      {
        heading: '3. Thông tin nên đính kèm',
        body: [
          'Vui lòng gửi từ hoặc ghi rõ địa chỉ email đăng ký tài khoản Zero Council của bạn. Với câu hỏi thanh toán, hãy kèm mã đơn hàng PayOS trong mục Lịch sử thanh toán. Với lỗi kết nối mô hình, hãy nêu tên nhà cung cấp và thông báo lỗi — tuyệt đối không gửi khóa API hoặc mật khẩu qua email.',
        ],
      },
    ],
  },
} as const;
