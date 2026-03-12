import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "wantsome 관리자",
  description: "wantsome 관리자 페이지",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
