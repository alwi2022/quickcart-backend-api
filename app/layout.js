export const metadata = {
  title: "QuickCart Backend",
  description: "QuickCart API service",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
