export const metadata = { title: "Lupe's Cleaning Booking API", description: "Tool API for an AI booking agent" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif", background: "#faf8fc", color: "#1d1530" }}>
        {children}
      </body>
    </html>
  );
}
