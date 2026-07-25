import "./globals.css";

export const metadata = {
  title: "Spa Weekend Appetizers 🥂",
  description: "Rank homemade appetizers with friends, 1 (ass) to 5 (good ass).",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
