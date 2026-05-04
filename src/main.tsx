import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import HomePage from "./pages/index";
import EventPage from "./pages/event";
import AdminPage from "./pages/admin";
import LoginPage from "./pages/login";
import ApplyPage from "./pages/apply";
import AdminEventApplicationsPage from "./pages/admin-event-applications";
import ProfilePage from "./pages/profile";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<AuthProvider>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/events/:eventId" element={<EventPage />} />
				<Route path="/admin" element={<AdminPage />} />
				<Route path="/admin/events/new" element={<AdminPage />} />
				<Route path="/admin/events/:eventId" element={<AdminPage />} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/signup" element={<LoginPage />} />
				<Route path="/apply/:eventId" element={<ApplyPage />} />
				<Route
					path="/admin/events/:eventId/applications"
					element={<AdminEventApplicationsPage />}
				/>
				<Route path="/profile" element={<ProfilePage />} />
				<Route path="/profile/:profileId" element={<ProfilePage />} />
			</Routes>
		</AuthProvider>
	</BrowserRouter>,
);
