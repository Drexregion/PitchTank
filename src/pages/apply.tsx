import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabaseClient";
import { Event } from "../types/Event";
import { EventQuestion } from "../types/Event";

const ApplyPage: React.FC = () => {
	const { eventId } = useParams<{ eventId: string }>();

	const [event, setEvent] = useState<Event | null>(null);
	const [questions, setQuestions] = useState<EventQuestion[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	const [applicantEmail, setApplicantEmail] = useState("");
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [uploadingFor, setUploadingFor] = useState<string | null>(null);
	const [autofilling, setAutofilling] = useState(false);
	const [autofillError, setAutofillError] = useState<string | null>(null);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	const didRestoreRef = useRef(false);

	// Load event + questions
	useEffect(() => {
		if (!eventId) return;
		supabase
			.from("events")
			.select("*")
			.eq("id", eventId)
			.single()
			.then(({ data, error }) => {
				if (error || !data) {
					setNotFound(true);
				} else {
					setEvent(data);
					const qs = (data.registration_questions ?? [])
						.slice()
						.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
					setQuestions(qs);
				}
				setIsLoading(false);
			});
	}, [eventId]);

	// Restore from localStorage after questions load
	useEffect(() => {
		if (!eventId || isLoading || didRestoreRef.current) return;
		didRestoreRef.current = true;
		try {
			const saved = localStorage.getItem(`pitchtank_apply_${eventId}`);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (parsed.applicantEmail) setApplicantEmail(parsed.applicantEmail);
				if (parsed.answers) setAnswers(parsed.answers);
			}
		} catch {
			// ignore malformed saved data
		}
	}, [eventId, isLoading]);

	// Auto-save to localStorage
	useEffect(() => {
		if (!eventId || isLoading) return;
		localStorage.setItem(
			`pitchtank_apply_${eventId}`,
			JSON.stringify({ applicantEmail, answers })
		);
	}, [eventId, applicantEmail, answers, isLoading]);

	const setAnswer = (questionId: string, value: string) => {
		setAnswers((prev) => ({ ...prev, [questionId]: value }));
		setFieldErrors((prev) => ({ ...prev, [questionId]: "" }));
	};

	const handleImageUpload = async (questionId: string, file: File) => {
		setUploadingFor(questionId);
		const path = `${eventId}/${questionId}/${Date.now()}_${file.name}`;
		const { error: uploadError } = await supabase.storage
			.from("application-images")
			.upload(path, file, { upsert: true });
		if (uploadError) {
			setFieldErrors((prev) => ({
				...prev,
				[questionId]: "Image upload failed. Please try again.",
			}));
			setUploadingFor(null);
			return;
		}
		const {
			data: { publicUrl },
		} = supabase.storage.from("application-images").getPublicUrl(path);
		setAnswer(questionId, publicUrl);
		setUploadingFor(null);
	};

	const handleAutofill = async (websiteQuestionId: string) => {
		let websiteUrl = answers[websiteQuestionId]?.trim();
		if (!websiteUrl) {
			setAutofillError("Enter a website URL first.");
			return;
		}
		// Prepend https:// if no protocol given
		if (!/^https?:\/\//i.test(websiteUrl)) {
			websiteUrl = `https://${websiteUrl}`;
			setAnswer(websiteQuestionId, websiteUrl);
		}
		try {
			new URL(websiteUrl);
		} catch {
			setAutofillError("Please enter a valid URL (e.g. https://example.com).");
			return;
		}

		setAutofilling(true);
		setAutofillError(null);

		const { data, error: fnError } = await supabase.functions.invoke(
			"scrape-website",
			{
				body: {
					url: websiteUrl,
					questions: questions.filter((q) => q.question_type !== "website_url"),
				},
			}
		);

		setAutofilling(false);

		if (fnError || !data?.answers) {
			setAutofillError(
				data?.error ?? fnError?.message ?? "Autofill failed. Please fill in manually."
			);
			return;
		}

		// Merge filled answers — only populate empty fields so user edits aren't overwritten
		setAnswers((prev) => {
			const merged = { ...prev };
			for (const [qId, val] of Object.entries(data.answers as Record<string, string>)) {
				if (!merged[qId]) merged[qId] = val;
			}
			return merged;
		});
	};

	const validate = () => {
		const errors: Record<string, string> = {};
		if (!applicantEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail)) {
			errors["__email"] = "Please enter a valid email address.";
		}
		for (const q of questions) {
			if (q.required && !answers[q.id]?.trim()) {
				errors[q.id] = "This field is required.";
			}
		}
		setFieldErrors(errors);
		return Object.keys(errors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;

		setIsSubmitting(true);
		setError(null);

		const { error: insertError } = await supabase
			.from("applications")
			.insert({
				event_id: eventId,
				applicant_email: applicantEmail,
				answers,
				status: "pending",
			});

		if (insertError) {
			setError("Failed to submit application. Please try again.");
			setIsSubmitting(false);
			return;
		}

		localStorage.removeItem(`pitchtank_apply_${eventId}`);

		// Fire-and-forget — don't block submission on email
		supabase.functions.invoke("send-application-received", {
			body: { to: applicantEmail, eventName: event?.name },
		}).catch(() => {});

		setSubmitted(true);
		setIsSubmitting(false);
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-950 flex items-center justify-center">
				<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
			</div>
		);
	}

	if (notFound || !event) {
		return (
			<div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
				<div className="text-center">
					<p className="text-xl font-semibold mb-2">Event not found.</p>
					<Link to="/" className="text-blue-400 hover:underline text-sm">
						Back to home
					</Link>
				</div>
			</div>
		);
	}

	if (submitted) {
		return (
			<div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
				<div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 max-w-lg w-full text-center">
					<div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center mx-auto mb-5">
						<svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<h2 className="text-2xl font-bold text-white mb-2">
						Application Submitted!
					</h2>
					<p className="text-gray-400 mb-6">
						We'll be in touch at{" "}
						<span className="text-white font-medium">{applicantEmail}</span>.
					</p>

<Link
						to={`/events/${eventId}`}
						className="text-gray-500 hover:text-gray-400 text-sm"
					>
						View event →
					</Link>
				</div>
			</div>
		);
	}

	// Split: website_url question always first, rest in original order
	const websiteQuestion = questions.find((q) => q.question_type === "website_url");
	const otherQuestions = questions.filter((q) => q.question_type !== "website_url");

	return (
		<div className="min-h-screen bg-gray-950 py-12 px-4">
			<div className="max-w-2xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<p className="text-gray-500 text-sm mb-1 uppercase tracking-widest">
						Application
					</p>
					<h1 className="text-3xl font-bold text-white">{event.name}</h1>
					{event.description && (
						<div className="mt-2 text-gray-400 prose prose-sm prose-invert max-w-none">
							<ReactMarkdown>{event.description}</ReactMarkdown>
						</div>
					)}
				</div>

				{error && (
					<div className="mb-6 bg-red-900/40 border border-red-700 text-red-300 p-4 rounded-lg text-sm">
						{error}
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-6">
					{/* Email */}
					<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
						<label className="block text-white font-medium mb-1.5">
							Email address <span className="text-red-400">*</span>
						</label>
						<p className="text-gray-500 text-xs mb-2">
							This email will be used as the main point of contact for your application status.
						</p>
						<input
							type="email"
							value={applicantEmail}
							onChange={(e) => {
								setApplicantEmail(e.target.value);
								setFieldErrors((prev) => ({ ...prev, __email: "" }));
							}}
							placeholder="you@example.com"
							disabled={autofilling}
							className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm disabled:cursor-not-allowed disabled:opacity-50"
						/>
						{fieldErrors["__email"] && (
							<p className="mt-1.5 text-red-400 text-xs">{fieldErrors["__email"]}</p>
						)}
					</div>

					{/* Website URL question — always pinned here if it exists */}
					{websiteQuestion && (
						<div className="bg-gray-900 border border-blue-800/50 rounded-xl p-5">
							<div className="flex items-start justify-between gap-3 mb-1.5">
								<label className="block text-white font-medium">
									{websiteQuestion.question_text}
									{websiteQuestion.required && (
										<span className="text-red-400 ml-1">*</span>
									)}
								</label>
								<span className="text-xs bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-full flex-shrink-0">
									Autofill
								</span>
							</div>
							<p className="text-gray-500 text-xs mb-3">
								{websiteQuestion.description || "Enter your website and we'll try to fill the rest of the form for you."}
							</p>
							<div className="flex gap-2">
								<input
									type="url"
									value={answers[websiteQuestion.id] ?? ""}
									onChange={(e) => setAnswer(websiteQuestion.id, e.target.value)}
									placeholder="https://yourcompany.com"
									className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
								/>
								<button
									type="button"
									onClick={() => handleAutofill(websiteQuestion.id)}
									disabled={autofilling || !answers[websiteQuestion.id]?.trim()}
									className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex-shrink-0 flex items-center gap-2"
								>
									{autofilling ? (
										<>
											<span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
											Filling…
										</>
									) : (
										"Autofill ✦"
									)}
								</button>
							</div>
							{fieldErrors[websiteQuestion.id] && (
								<p className="mt-1.5 text-red-400 text-xs">
									{fieldErrors[websiteQuestion.id]}
								</p>
							)}
							{autofillError && (
								<p className="mt-1.5 text-yellow-400 text-xs">{autofillError}</p>
							)}
						</div>
					)}

					{/* All other questions */}
					{otherQuestions.map((q) => (
						<div
							key={q.id}
							className={`bg-gray-900 border border-gray-800 rounded-xl p-5 transition-opacity ${autofilling ? "opacity-50 pointer-events-none" : ""}`}
						>
							<label className="block text-white font-medium mb-1.5">
								{q.question_text}
								{q.required && <span className="text-red-400 ml-1">*</span>}
							</label>
							{q.description && (
								<p className="text-gray-500 text-xs mb-2">{q.description}</p>
							)}

							{q.question_type === "text" && (
								<textarea
									value={answers[q.id] ?? ""}
									onChange={(e) => setAnswer(q.id, e.target.value)}
									rows={2}
									disabled={autofilling}
									className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y disabled:cursor-not-allowed whitespace-pre-wrap break-words"
								/>
							)}

							{q.question_type === "textarea" && (
								<textarea
									value={answers[q.id] ?? ""}
									onChange={(e) => setAnswer(q.id, e.target.value)}
									rows={6}
									disabled={autofilling}
									className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y disabled:cursor-not-allowed whitespace-pre-wrap break-words"
								/>
							)}

							{q.question_type === "url" && (
								<input
									type="url"
									value={answers[q.id] ?? ""}
									onChange={(e) => setAnswer(q.id, e.target.value)}
									placeholder="https://"
									disabled={autofilling}
									className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm disabled:cursor-not-allowed"
								/>
							)}

							{q.question_type === "image" && (
								<div>
									<label className="block w-full cursor-pointer">
										<div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 hover:border-blue-500 transition-colors">
											<span className="text-gray-400 text-sm">
												{uploadingFor === q.id
													? "Uploading..."
													: answers[q.id]
													? "Change image"
													: "Choose image (PNG, JPG, max 10MB)"}
											</span>
										</div>
										<input
											type="file"
											accept="image/*"
											className="hidden"
											disabled={uploadingFor === q.id || autofilling}
											onChange={(e) => {
												const file = e.target.files?.[0];
												if (file) handleImageUpload(q.id, file);
											}}
										/>
									</label>
									{answers[q.id] && (
										<img
											src={answers[q.id]}
											alt="Uploaded preview"
											className="mt-3 max-h-48 rounded-lg border border-gray-700 object-contain"
										/>
									)}
								</div>
							)}

							{fieldErrors[q.id] && (
								<p className="mt-1.5 text-red-400 text-xs">{fieldErrors[q.id]}</p>
							)}
						</div>
					))}

					<div className="flex justify-between items-center pt-2">
						<button
							type="button"
							disabled={autofilling}
							onClick={() => {
								setApplicantEmail("");
								setAnswers({});
								setFieldErrors({});
								setAutofillError(null);
							}}
							className="px-4 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Clear all
						</button>
						<button
							type="submit"
							disabled={isSubmitting || autofilling}
							className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
						>
							{isSubmitting ? "Submitting..." : "Submit Application"}
						</button>
					</div>
				</form>

				<p className="text-center text-gray-600 text-xs mt-8">
					Your progress is saved automatically — you can return to this page
					to continue your application.
				</p>
			</div>
		</div>
	);
};

export default ApplyPage;
