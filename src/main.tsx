import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/index';
import EventPage from './pages/event';
import DashboardPage from './pages/dashboard';
import AdminPage from './pages/admin';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
import FounderSignupPage from './pages/founder-signup';
import FounderLoginPage from './pages/founder-login';
import FounderDashboardPage from './pages/founder-dashboard';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events/:eventId" element={<EventPage />} />
        <Route path="/dashboard/:eventId" element={<DashboardPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/founder-signup/:token" element={<FounderSignupPage />} />
        <Route path="/founder-login" element={<FounderLoginPage />} />
        <Route path="/founder-dashboard" element={<FounderDashboardPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
