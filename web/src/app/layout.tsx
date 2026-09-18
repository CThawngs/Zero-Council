import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zero Council — Hội đồng AI",
  description: "Bản mẫu hội đồng cố vấn đa góc nhìn. Nội dung viết sẵn, chưa kết nối AI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
