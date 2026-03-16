import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrderProvider } from "@/contexts/OrderContext";

export const metadata: Metadata = {
  title: "KH POS — Cambodia Restaurant System",
  description: "Local-first Point of Sale system for Cambodian restaurants. Dual USD/KHR, GDT tax compliance, Bakong/KHQR ready.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
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
