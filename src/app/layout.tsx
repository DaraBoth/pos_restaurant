import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrderProvider } from "@/contexts/OrderContext";

export const metadata: Metadata = {
  title: "KH POS — Gen Z Vibe",
  description: "Next-gen Point of Sale system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <LanguageProvider>
          <AuthProvider>
            <OrderProvider>
              {children}
            </OrderProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
