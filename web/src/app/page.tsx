"use client";

import { useState } from "react";

const question = "Có 8 tuần, 8 giờ/tuần và ngân sách 0 đồng: nên học backend, frontend hay làm portfolio để xin thực tập?";
const opinions = [
  { name: "Cố vấn kỹ năng", text: "Nếu đã có nền tảng lập trình, chọn một dự án portfolio nhỏ để thể hiện kỹ năng. Nếu chưa, dành hai tuần đầu củng cố nền tảng." },
  { name: "Cố vấn cơ hội", text: "Đọc yêu cầu tuyển thực tập ở khu vực bạn muốn làm việc trước khi chọn frontend hay backend. Chưa có dữ liệu tuyển dụng trong bản mẫu này." },
  { name: "Cố vấn rủi ro", text: "64 giờ là quỹ thời gian hữu hạn. Chọn một luồng hoàn chỉnh, tránh học đồng thời nhiều framework. Dành thời gian viết test và luyện giải thích code." },
];

export default function Home() {
  const [showSample, setShowSample] = useState(false);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-5 py-10 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-300 pb-6 dark:border-zinc-700">
        <div>
          <p className="text-sm font-semibold tracking-widest">ZERO COUNCIL</p>
          <h1 className="mt-2 text-3xl font-bold">Nhiều góc nhìn. Quyết định của bạn.</h1>
        </div>
        <span className="rounded-full border px-4 py-2 text-sm">Bản mẫu · Không gọi AI</span>
      </header>

      <p className="max-w-3xl text-lg">Hội đồng cố vấn hỗ trợ bạn so sánh lựa chọn, nhận diện rủi ro và xây dựng bước tiếp theo. Không thay thế chuyên gia y tế, pháp lý hoặc tài chính.</p>

      <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        <aside className="space-y-4 rounded-2xl border border-zinc-300 p-6 dark:border-zinc-700">
          <h2 className="text-xl font-semibold">Hội đồng mẫu</h2>
          <ul className="space-y-3">
            {opinions.map(({ name }) => <li key={name}>{name} <span className="text-sm">· dữ liệu mẫu</span></li>)}
            <li>Điều phối · dữ liệu mẫu</li>
          </ul>
          <p className="text-sm">Chưa có đăng nhập, lưu session, tải file hoặc kết nối provider. Tải lại trang sẽ xóa trạng thái bản mẫu.</p>
        </aside>

        <section className="space-y-5" aria-labelledby="sample-heading">
          <h2 id="sample-heading" className="text-xl font-semibold">Chọn hướng chuẩn bị thực tập</h2>
          <blockquote className="rounded-2xl bg-zinc-100 p-6 dark:bg-zinc-900">{question}</blockquote>
          <p>Nội dung bên dưới được viết sẵn cho câu hỏi này, không phải câu trả lời AI trực tiếp.</p>
          <button
            type="button"
            onClick={() => setShowSample(!showSample)}
            aria-expanded={showSample}
            aria-controls="sample-results"
            className="rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500"
          >
            {showSample ? "Ẩn phân tích mẫu" : "Xem phân tích mẫu"}
          </button>
          <div id="sample-results" hidden={!showSample} className="space-y-4">
            {opinions.map(({ name, text }) => (
              <article key={name} className="rounded-2xl border border-zinc-300 p-5 dark:border-zinc-700">
                <h3 className="font-semibold">{name}</h3>
                <p className="mt-2">{text}</p>
              </article>
            ))}
            <article className="rounded-2xl border-2 border-indigo-500 p-5">
              <h3 className="font-semibold">Tổng hợp mẫu</h3>
              <p className="mt-2">Chưa đủ dữ kiện để chọn thay bạn. Trước tiên xác định nền tảng hiện tại và vị trí thực tập mục tiêu. Sau đó chọn một dự án nhỏ phù hợp, có demo và test. Đây là gợi ý theo giả định, không bảo đảm cơ hội tuyển dụng.</p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
