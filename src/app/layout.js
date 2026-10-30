import { query } from '@/lib/db';
import "./globals.css";

export async function generateMetadata() {
  let appName = 'Portal';

  try {
    const settings = await query('SELECT * FROM settings WHERE id = 1');
    if (settings && settings.length > 0) {
      appName = settings[0].app_name || 'Portal';
    }
  } catch (e) {
    // Handle fallback during static build phases
  }

  return {
    title: appName,
    description: "Order Management Portal"
  };
}

export default async function RootLayout({ children }) {
  let favicon = '/favicon.ico';

  try {
    const settings = await query('SELECT * FROM settings WHERE id = 1');
    if (settings && settings.length > 0 && settings[0].favicon) {
      favicon = settings[0].favicon;
    }
  } catch (e) {
    // Handle fallback during static build phases
  }

  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href={favicon} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
