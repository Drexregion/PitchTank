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
import SettingsPage from "./pages/settings";
import ForgotPasswordPage from "./pages/forgot-password";
import OnboardingPage from "./pages/onboarding";
import WelcomePage from "./pages/welcome";
import MessagesPage from "./pages/messages";
import { OnboardingGate } from "./components/OnboardingGate";
import { resolveSupabaseClient } from "./lib/supabaseClient";
import "./index.css";

// Fire the failover health check early so the result is cached before any component needs it
resolveSupabaseClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<AuthProvider>
			<OnboardingGate>
				<Routes>
					<Route path="/" element={<HomePage />} />
					<Route path="/events/:eventId" element={<EventPage />} />
					<Route
						path="/events/:eventId/conversations"
						element={<EventPage />}
					/>
					<Route path="/events/:eventId/chat" element={<EventPage />} />
					<Route path="/events/:eventId/dm/:peerId" element={<EventPage />} />
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
					<Route path="/settings" element={<SettingsPage />} />
					<Route path="/forgot-password" element={<ForgotPasswordPage />} />
					<Route path="/onboarding" element={<OnboardingPage />} />
					<Route path="/welcome" element={<WelcomePage />} />
					<Route path="/messages" element={<MessagesPage />} />
					<Route path="/messages/dm/:peerId" element={<MessagesPage />} />
				</Routes>
			</OnboardingGate>
		</AuthProvider>
	</BrowserRouter>,
);
