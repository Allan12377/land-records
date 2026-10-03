import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Groundwork | Uganda Land Registry",
  description: "A secure registry workspace prototype for land and source records.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
