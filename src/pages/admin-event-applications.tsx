import React, { useState, useEffect, useCallback } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../hooks/useAuth";
import { Event } from "../types/Event";
import { Application, EventQuestion } from "../types/Application";


const statusStyles: Record<string, string> = {
	pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
	approved: "bg-green-100 text-green-800 border-green-200",
	rejected: "bg-red-100 text-red-800 border-red-200",
};

interface AnswerModalProps {
	application: Application;
	questions: EventQuestion[];
	onClose: () => void;
}

const AnswerModal: React.FC<AnswerModalProps> = ({
	application,
	questions,
	onClose,
}) => {
	return (
		<div
			className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
			onClick={onClose}
		>
			<div
				className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between p-5 border-b">
					<div>
						<h3 className="font-semibold text-gray-900">
							{application.applicant_email}
						</h3>
						<p className="text-xs text-gray-400 mt-0.5">
							Submitted{" "}
							{new Date(application.submitted_at).toLocaleString()}
						</p>
					</div>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-700 text-xl leading-none"
					>
						✕
					</button>
				</div>

				<div className="p-5 space-y-5">
					{questions.length === 0 ? (
						<p className="text-gray-500 text-sm">No questions defined for this event.</p>
					) : (
						questions.map((q) => {
							const answer = application.answers[q.id];
							return (
								<div key={q.id}>
									<p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
										{q.question_text}
									</p>
									{!answer ? (
										<p className="text-gray-400 text-sm italic">No answer</p>
									) : q.question_type === "image" ? (
										<img
											src={answer}
											alt={q.question_text}
											className="max-w-full max-h-64 rounded-lg border border-gray-200 object-contain"
										/>
									) : q.question_type === "url" ? (
										<a
											href={answer}
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-600 hover:underline text-sm break-all"
										>
											{answer}
										</a>
									) : (
										<p className="text-gray-800 text-sm whitespace-pre-wrap">{answer}</p>
									)}
								</div>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
};

const AdminEventApplicationsPage: React.FC = () => {
	const { eventId } = useParams<{ eventId: string }>();
	const { isAdmin, isLoading: authLoading } = useAuth();

	const [event, setEvent] = useState<Event | null>(null);
	const [questions, setQuestions] = useState<EventQuestion[]>([]);
	const [applications, setApplications] = useState<Application[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [viewingApplication, setViewingApplication] =
		useState<Application | null>(null);
	const [actionLoading, setActionLoading] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		if (!eventId) return;
		setIsLoading(true);
		try {
			const [eventRes, appsRes] = await Promise.all([
				supabase.from("events").select("*").eq("id", eventId).single(),
				supabase
					.from("applications")
					.select("*")
					.eq("event_id", eventId)
					.order("submitted_at", { ascending: false }),
			]);
			if (eventRes.error) throw eventRes.error;
			setEvent(eventRes.data);
			const qs = (eventRes.data?.registration_questions ?? [])
				.slice()
				.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
			setQuestions(qs);
			setApplications(appsRes.data ?? []);
		} catch (err: any) {
			setError(err.message ?? "Failed to load data");
		} finally {
			setIsLoading(false);
		}
	}, [eventId]);

	useEffect(() => {
		if (!authLoading && isAdmin) fetchData();
	}, [authLoading, isAdmin, fetchData]);

	const handleApprove = async (application: Application) => {
		setActionLoading(application.id);
		const { error: updateError } = await supabase
			.from("applications")
			.update({ status: "approved", reviewed_at: new Date().toISOString() })
			.eq("id", application.id);

		if (updateError) {
			setError(updateError.message);
			setActionLoading(null);
			return;
		}

		// Send acceptance email via Resend
		supabase.functions.invoke("send-application-accepted", {
			body: {
				to: application.applicant_email,
				eventName: event?.name,
				claimToken: application.claim_token,
			},
		}).catch(() => {});

		setApplications((prev) =>
			prev.map((a) =>
				a.id === application.id
					? { ...a, status: "approved", reviewed_at: new Date().toISOString() }
					: a
			)
		);
		setActionLoading(null);
	};

	const handleReject = async (applicationId: string) => {
		setActionLoading(applicationId);
		const { error: updateError } = await supabase
			.from("applications")
			.update({ status: "rejected", reviewed_at: new Date().toISOString() })
			.eq("id", applicationId);

		if (updateError) {
			setError(updateError.message);
			setActionLoading(null);
			return;
		}

		setApplications((prev) =>
			prev.map((a) =>
				a.id === applicationId
					? { ...a, status: "rejected", reviewed_at: new Date().toISOString() }
					: a
			)
		);
		setActionLoading(null);
	};

	if (authLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
			</div>
		);
	}

	if (!isAdmin) return <Navigate to="/" replace />;

	const formatDate = (ds: string) =>
		new Date(ds).toLocaleString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});

	const pending = applications.filter((a) => a.status === "pending");
	const reviewed = applications.filter((a) => a.status !== "pending");

	return (
		<div className="min-h-screen bg-gray-50 text-black">
			<Navbar />

			{viewingApplication && (
				<AnswerModal
					application={viewingApplication}
					questions={questions}
					onClose={() => setViewingApplication(null)}
				/>
			)}

			<div className="container mx-auto px-4 py-8">
				<div className="flex items-center gap-3 mb-1">
					<Link to="/admin" className="text-gray-400 hover:text-gray-700 text-sm">
						← Admin
					</Link>
				</div>

				<div className="flex items-start justify-between mb-6">
					<div>
						<h1 className="text-2xl font-bold text-gray-900">
							{event?.name ?? "Event"} — Applications
						</h1>
						<p className="text-gray-500 text-sm mt-0.5">
							{applications.length} total · {pending.length} pending
						</p>
					</div>
					<a
						href={`/apply/${eventId}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm text-blue-600 hover:underline"
					>
						View apply page →
					</a>
				</div>

				{error && (
					<div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm">
						{error}
					</div>
				)}

				{isLoading ? (
					<div className="flex justify-center py-16">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
					</div>
				) : applications.length === 0 ? (
					<div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
						<p className="text-lg font-medium mb-1">No applications yet</p>
						<p className="text-sm">Share the apply link to start receiving submissions.</p>
					</div>
				) : (
					<div className="space-y-8">
						{/* Pending */}
						{pending.length > 0 && (
							<div>
								<h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
									Pending ({pending.length})
								</h2>
								<div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
									{pending.map((app) => (
										<ApplicationRow
											key={app.id}
											application={app}
											actionLoading={actionLoading}
											formatDate={formatDate}
											onView={() => setViewingApplication(app)}
											onApprove={() => handleApprove(app)}
											onReject={() => handleReject(app.id)}
										/>
									))}
								</div>
							</div>
						)}

						{/* Reviewed */}
						{reviewed.length > 0 && (
							<div>
								<h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
									Reviewed ({reviewed.length})
								</h2>
								<div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
									{reviewed.map((app) => (
										<ApplicationRow
											key={app.id}
											application={app}
											actionLoading={actionLoading}
											formatDate={formatDate}
											onView={() => setViewingApplication(app)}
											onApprove={() => handleApprove(app)}
											onReject={() => handleReject(app.id)}
										/>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

interface ApplicationRowProps {
	application: Application;
	actionLoading: string | null;
	formatDate: (ds: string) => string;
	onView: () => void;
	onApprove: () => void;
	onReject: () => void;
}

const ApplicationRow: React.FC<ApplicationRowProps> = ({
	application,
	actionLoading,
	formatDate,
	onView,
	onApprove,
	onReject,
}) => {
	const isLoading = actionLoading === application.id;

	return (
		<div className="flex items-center gap-4 px-5 py-4">
			<div className="flex-1 min-w-0">
				<p className="font-medium text-gray-900 truncate">
					{application.applicant_email}
				</p>
				<p className="text-xs text-gray-400 mt-0.5">
					{formatDate(application.submitted_at)}
				</p>
			</div>

			<span
				className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${
					statusStyles[application.status] ?? "bg-gray-100 text-gray-700 border-gray-200"
				}`}
			>
				{application.status}
			</span>

			<div className="flex items-center gap-2 flex-shrink-0">
				<button
					onClick={onView}
					className="text-xs text-blue-600 hover:underline font-medium"
				>
					View
				</button>

				{application.status !== "approved" && (
					<button
						onClick={onApprove}
						disabled={isLoading}
						className="text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-2.5 py-1 rounded-lg font-medium transition-colors"
					>
						{isLoading ? "..." : "Approve"}
					</button>
				)}

				{application.status !== "rejected" && (
					<button
						onClick={onReject}
						disabled={isLoading}
						className="text-xs bg-white hover:bg-red-50 disabled:opacity-50 text-red-600 border border-red-200 hover:border-red-400 px-2.5 py-1 rounded-lg font-medium transition-colors"
					>
						{isLoading ? "..." : "Reject"}
					</button>
				)}
			</div>
		</div>
	);
};

export default AdminEventApplicationsPage;
