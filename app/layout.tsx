import {siteUrl,siteName,siteDescription,pageMetadata} from "@/lib/seo";
import Script from "next/script";
import type { Metadata } from "next";
import { Header, Footer } from "@/components/client";
import "./globals.css";
export const metadata: Metadata = {
  ...pageMetadata(siteName,siteDescription,"/"),
  metadataBase: new URL(siteUrl),
  title: {default:"TBN — The Bittrees News",template:"%s | TBN"},
  alternates: undefined,
  applicationName:siteName,
  icons:{icon:[{url:"/favicon.ico",sizes:"32x32"},{url:"/brand/tbn-mark.svg",type:"image/svg+xml"}],apple:[{url:"/brand/tbn-180.png",sizes:"180x180"}]},
  manifest:"/manifest.webmanifest",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="site">
          <Header />
          <main>{children}</main>
          <Footer />
        </div>
        <Script
          src="https://insights.bittrees.org/consent.js"
          data-insights-site="bittrees-news"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
