import { Routes, Route } from 'react-router-dom';
import { BookingPage } from './pages/BookingPage';
import { ConfirmationPage } from './pages/ConfirmationPage';

function ManageBookingPage() {
  return <div className="min-h-screen bg-gray-50 p-8 text-center">Manage booking — M6</div>;
}

function MentorPage() {
  return <div className="min-h-screen bg-gray-50 p-8 text-center">Mentor view — M6</div>;
}

function OutboxPage() {
  return <div className="min-h-screen bg-gray-50 p-8 text-center">Notification outbox — M6</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BookingPage />} />
      <Route path="/booking/:token" element={<ManageBookingPage />} />
      <Route path="/confirmation/:token" element={<ConfirmationPage />} />
      <Route path="/mentor" element={<MentorPage />} />
      <Route path="/outbox" element={<OutboxPage />} />
    </Routes>
  );
}
