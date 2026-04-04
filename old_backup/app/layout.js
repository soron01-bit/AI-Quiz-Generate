import './globals.css';
import { AuthProvider } from '../context/AuthContext';

export const metadata = {
  title: 'AI Study Assistant',
  description: 'AI-powered study assistant using Firebase and Gemini AI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
