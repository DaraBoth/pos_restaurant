import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { OrderProvider } from "@/providers/OrderProvider";
import RouteGuard from "@/components/auth/RouteGuard";
import AppUpdater from "@/components/ui/AppUpdater";

export const metadata: Metadata = {
  title: "DineOS — Premium POS System",
  description: "DineOS — Modern, professional Point of Sale system.",
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
              <RouteGuard>{children}</RouteGuard>
              <AppUpdater />
            </OrderProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
