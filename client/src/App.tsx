import { Routes, Route } from 'react-router-dom';
import { BookingPage } from './pages/BookingPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { ManageBookingPage } from './pages/ManageBookingPage';
import { MentorPage } from './pages/MentorPage';
import { OutboxPage } from './pages/OutboxPage';

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
