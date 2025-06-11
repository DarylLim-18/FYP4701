'use client'; // Needed for interactive sidebar
import "./globals.css";
import Sidebar from './components/Sidebar/Sidebar';


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen">
          <Sidebar />   
          <div className="flex-1 overflow-auto">
            <main className="p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
