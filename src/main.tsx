import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/index";
import EventPage from "./pages/event";
import AdminPage from "./pages/admin";
import LoginPage from "./pages/login";
import ApplyPage from "./pages/apply";
import AdminEventApplicationsPage from "./pages/admin-event-applications";
import ProfilePage from "./pages/profile";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/events/:eventId" element={<EventPage />} />
				<Route path="/admin" element={<AdminPage />} />
				<Route path="/admin/events/new" element={<AdminPage />} />
				<Route path="/admin/events/:eventId" element={<AdminPage />} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/apply/:eventId" element={<ApplyPage />} />
				<Route path="/admin/events/:eventId/applications" element={<AdminEventApplicationsPage />} />
				<Route path="/profile" element={<ProfilePage />} />
			</Routes>
		</BrowserRouter>
	</React.StrictMode>
);
