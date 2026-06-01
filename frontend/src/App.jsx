import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import MediaDetailPage from './pages/MediaDetailPage';
import UploadPage from './pages/UploadPage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage';
import FavouritesPage from './pages/FavouritesPage';
import MyPhotosPage from './pages/MyPhotosPage';
import CreateEventPage from './pages/CreateEventPage';
import RequestAccessPage from './pages/RequestAccessPage';
import AdminDashboard from './pages/AdminDashboard';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"/></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="media/:id" element={<MediaDetailPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="favourites" element={<ProtectedRoute><FavouritesPage /></ProtectedRoute>} />
        <Route path="my-photos" element={<ProtectedRoute><MyPhotosPage /></ProtectedRoute>} />
        <Route path="request-access" element={<ProtectedRoute><RequestAccessPage /></ProtectedRoute>} />
        <Route path="upload" element={<ProtectedRoute roles={['admin','photographer']}><UploadPage /></ProtectedRoute>} />
        <Route path="events/new" element={<ProtectedRoute roles={['admin']}><CreateEventPage /></ProtectedRoute>} />
        <Route path="admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      </Route>
    </Routes>
    <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid #3a3a3a' } }} />
  </BrowserRouter>
);

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    </AuthProvider>
  );
}
