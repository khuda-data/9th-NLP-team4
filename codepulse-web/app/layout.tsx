import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CodePulse — 내 코드를 아는 AI 트렌드 레이더",
  description: "연결된 레포에 영향 주는 AI 트렌드만 골라주는 개인 레이더",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
