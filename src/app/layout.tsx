import type { ReactNode } from "react";

export const metadata = {
  title: "Second Brain",
  description: "AI second-brain knowledge assistant",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
