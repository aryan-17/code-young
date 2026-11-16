import { Routes, Route } from 'react-router-dom';

function BookingPage() {
  return <div>Booking flow — M5</div>;
}

function ConfirmationPage() {
  return <div>Booking confirmation — M5</div>;
}

function ManageBookingPage() {
  return <div>Manage booking — M6</div>;
}

function MentorPage() {
  return <div>Mentor view — M6</div>;
}

function OutboxPage() {
  return <div>Notification outbox — M6</div>;
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
