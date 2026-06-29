import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { OrderProvider } from "@/providers/OrderProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import RouteGuard from "@/components/auth/RouteGuard";

import AppShell from "@/components/layout/AppShell";
import ReceiptPrintSheet from "@/components/pos/ReceiptPrintSheet";
import GlobalErrorReporter from "@/components/ui/GlobalErrorReporter";


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
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <GlobalErrorReporter />
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <OrderProvider>
                <RouteGuard>
                  <AppShell>{children}</AppShell>
                  <ReceiptPrintSheet />
                </RouteGuard>

              </OrderProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
