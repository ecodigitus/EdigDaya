import { Navigate, Route, Routes } from 'react-router-dom';
import AdminArea from './AdminArea';
import Landing from './pages/Landing';
import PortalEntry from './pages/PortalEntry';
import MemberPortal from './pages/MemberPortal';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/portal" element={<PortalEntry />} />
      <Route path="/portal/:noAnggota" element={<MemberPortal />} />
      <Route path="/admin/*" element={<AdminArea />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
