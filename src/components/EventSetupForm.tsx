import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabaseClient";
import { Event } from "../types/Event";

interface EventSetupFormProps {
	onEventCreated?: (event: Event) => void;
	onEventUpdated?: (event: Event) => void;
	eventId?: string; // when provided, component is in edit mode
}

type Tab = "event-info" | "questionnaire" | "settings";

interface QuestionDraft {
	id: string;
	question_text: string;
	description: string;
	question_type: "text" | "textarea" | "image" | "url" | "website_url";
	required: boolean;
}

// Converts a DB timestamptz string to the value needed by datetime-local inputs
const toDatetimeLocal = (ts: string) =>
	ts ? new Date(ts).toISOString().slice(0, 16) : "";

export const EventSetupForm: React.FC<EventSetupFormProps> = ({
	onEventCreated,
	onEventUpdated,
	eventId,
}) => {
	const isEditMode = !!eventId;
	const [activeTab, setActiveTab] = useState<Tab>("event-info");
	const [isLoadingData, setIsLoadingData] = useState(isEditMode);

	// Event info
	const [eventName, setEventName] = useState<string>("");
	const [eventDescription, setEventDescription] = useState<string>("");
	const [startTime, setStartTime] = useState<string>("");
	const [endTime, setEndTime] = useState<string>("");

	// Questionnaire
	const [questions, setQuestions] = useState<QuestionDraft[]>([]);

	// Settings
	const [hideLeaderboardAndPrices, setHideLeaderboardAndPrices] =
		useState<boolean>(false);

	const [descriptionPreview, setDescriptionPreview] = useState(false);

	// Form status
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Load existing data in edit mode
	useEffect(() => {
		if (!eventId) return;
		Promise.all([
			supabase.from("events").select("*").eq("id", eventId).single(),
			supabase.from("event_settings").select("*").eq("event_id", eventId).single(),
			supabase
				.from("event_questions")
				.select("*")
				.eq("event_id", eventId)
				.order("sort_order", { ascending: true }),
		]).then(([eventRes, settingsRes, questionsRes]) => {
			if (eventRes.data) {
				const ev = eventRes.data;
				setEventName(ev.name ?? "");
				setEventDescription(ev.description ?? "");
				setStartTime(toDatetimeLocal(ev.start_time));
				setEndTime(toDatetimeLocal(ev.end_time));
			}
			if (settingsRes.data) {
				setHideLeaderboardAndPrices(
					settingsRes.data.hide_leaderboard_and_prices ?? false
				);
			}
			if (questionsRes.data) {
				setQuestions(
					questionsRes.data.map((q: any) => ({
						id: q.id,
						question_text: q.question_text,
						description: q.description ?? "",
						question_type: q.question_type,
						required: q.required,
					}))
				);
			}
			setIsLoadingData(false);
		});
	}, [eventId]);

	const addQuestion = () => {
		setQuestions((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				question_text: "",
				description: "",
				question_type: "text",
				required: false,
			},
		]);
	};

	const removeQuestion = (id: string) => {
		setQuestions((prev) => prev.filter((q) => q.id !== id));
	};

	const updateQuestion = (id: string, patch: Partial<QuestionDraft>) => {
		setQuestions((prev) =>
			prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
		);
	};

	const moveQuestion = (index: number, direction: "up" | "down") => {
		const next = [...questions];
		const target = direction === "up" ? index - 1 : index + 1;
		if (target < 0 || target >= next.length) return;
		[next[index], next[target]] = [next[target], next[index]];
		setQuestions(next);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setError(null);
		setSuccess(null);

		try {
			if (!eventName || !startTime || !endTime) {
				throw new Error("Please fill in all required event fields");
			}
			if (new Date(startTime) >= new Date(endTime)) {
				throw new Error("End time must be after start time");
			}

			if (isEditMode) {
				// ── EDIT MODE ──────────────────────────────────────────
				const { data: eventData, error: eventError } = await supabase
					.from("events")
					.update({
						name: eventName,
						description: eventDescription,
						start_time: startTime,
						end_time: endTime,
					})
					.eq("id", eventId)
					.select()
					.single();

				if (eventError) throw eventError;
				if (!eventData) throw new Error("Failed to update event");

				const { error: settingsError } = await supabase
					.from("event_settings")
					.update({ hide_leaderboard_and_prices: hideLeaderboardAndPrices })
					.eq("event_id", eventId);

				if (settingsError) throw settingsError;

				// Replace questions: delete all then re-insert current list
				const { error: deleteError } = await supabase
					.from("event_questions")
					.delete()
					.eq("event_id", eventId);
				if (deleteError) throw deleteError;

				if (questions.length > 0) {
					const { error: questionsError } = await supabase
						.from("event_questions")
						.insert(
							questions.map((q, idx) => ({
								event_id: eventId,
								question_text: q.question_text,
								description: q.description || null,
								question_type: q.question_type,
								required: q.required,
								sort_order: idx,
							}))
						);
					if (questionsError) throw questionsError;
				}

				setSuccess(`Event "${eventName}" updated successfully!`);
				if (onEventUpdated) onEventUpdated(eventData);
			} else {
				// ── CREATE MODE ────────────────────────────────────────
				const { data: eventData, error: eventError } = await supabase
					.from("events")
					.insert({
						name: eventName,
						description: eventDescription,
						start_time: startTime,
						end_time: endTime,
						status: "draft",
					})
					.select()
					.single();

				if (eventError) throw eventError;
				if (!eventData) throw new Error("Failed to create event");

				const { error: settingsError } = await supabase
					.from("event_settings")
					.insert({
						event_id: eventData.id,
						snapshot_interval_seconds: 60,
						max_price_history_points: 10000,
						hide_leaderboard_and_prices: hideLeaderboardAndPrices,
					});
				if (settingsError) throw settingsError;

				if (questions.length > 0) {
					const { error: questionsError } = await supabase
						.from("event_questions")
						.insert(
							questions.map((q, idx) => ({
								event_id: eventData.id,
								question_text: q.question_text,
								description: q.description || null,
								question_type: q.question_type,
								required: q.required,
								sort_order: idx,
							}))
						);
					if (questionsError) throw questionsError;
				}

				setSuccess(`Event "${eventName}" created successfully!`);
				setEventName("");
				setEventDescription("");
				setStartTime("");
				setEndTime("");
				setQuestions([]);
				setHideLeaderboardAndPrices(false);
				setActiveTab("event-info");

				if (onEventCreated) onEventCreated(eventData);
			}
		} catch (err: any) {
			setError(err.message || "An error occurred");
		} finally {
			setIsSubmitting(false);
		}
	};

	const tabClass = (tab: Tab) =>
		`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
			activeTab === tab
				? "border-blue-500 text-blue-600"
				: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
		}`;

	const questionTypeLabel: Record<QuestionDraft["question_type"], string> = {
		website_url: "Website URL (autofill)",
		text: "Short Text",
		textarea: "Long Answer",
		image: "Image Upload",
		url: "URL",
	};

	if (isLoadingData) {
		return (
			<div className="bg-white rounded-xl shadow-md p-10 flex justify-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
			</div>
		);
	}

	return (
		<div className="bg-white rounded-xl shadow-md overflow-hidden">
			<div className="p-6">
				<h2 className="text-2xl font-bold mb-6">
					{isEditMode ? "Edit Event" : "Create New Event"}
				</h2>

				{error && (
					<div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
						{error}
					</div>
				)}

				{success && (
					<div className="mb-6 bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg">
						{success}
					</div>
				)}

				{/* Tab bar */}
				<div className="flex border-b border-gray-200 mb-6">
					<button
						type="button"
						className={tabClass("event-info")}
						onClick={() => setActiveTab("event-info")}
					>
						Event Info
					</button>
					<button
						type="button"
						className={tabClass("questionnaire")}
						onClick={() => setActiveTab("questionnaire")}
					>
						Questionnaire
						{questions.length > 0 && (
							<span className="ml-1.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
								{questions.length}
							</span>
						)}
					</button>
					<button
						type="button"
						className={tabClass("settings")}
						onClick={() => setActiveTab("settings")}
					>
						Settings
					</button>
				</div>

				<form onSubmit={handleSubmit}>
					{/* Event Info Tab */}
					{activeTab === "event-info" && (
						<div className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-gray-700 mb-1">
										Event Name <span className="text-red-500">*</span>
									</label>
									<input
										type="text"
										value={eventName}
										onChange={(e) => setEventName(e.target.value)}
										className="w-full p-2 border rounded-lg"
										required
									/>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-gray-700 mb-1">
											Start Time <span className="text-red-500">*</span>
										</label>
										<input
											type="datetime-local"
											value={startTime}
											onChange={(e) => setStartTime(e.target.value)}
											className="w-full p-2 border rounded-lg"
											required
										/>
									</div>
									<div>
										<label className="block text-gray-700 mb-1">
											End Time <span className="text-red-500">*</span>
										</label>
										<input
											type="datetime-local"
											value={endTime}
											onChange={(e) => setEndTime(e.target.value)}
											className="w-full p-2 border rounded-lg"
											required
										/>
									</div>
								</div>
							</div>

							<div>
								<div className="flex items-center justify-between mb-1">
									<label className="block text-gray-700">Event Description</label>
									<div className="flex text-xs border border-gray-200 rounded-lg overflow-hidden">
										<button
											type="button"
											onClick={() => setDescriptionPreview(false)}
											className={`px-2.5 py-1 transition-colors ${!descriptionPreview ? "bg-gray-100 text-gray-800 font-medium" : "text-gray-400 hover:text-gray-600"}`}
										>
											Write
										</button>
										<button
											type="button"
											onClick={() => setDescriptionPreview(true)}
											className={`px-2.5 py-1 transition-colors ${descriptionPreview ? "bg-gray-100 text-gray-800 font-medium" : "text-gray-400 hover:text-gray-600"}`}
										>
											Preview
										</button>
									</div>
								</div>
								{descriptionPreview ? (
									<div className="w-full p-2 border rounded-lg min-h-[76px] prose prose-sm max-w-none text-gray-700">
										{eventDescription
											? <ReactMarkdown>{eventDescription}</ReactMarkdown>
											: <span className="text-gray-400 italic">Nothing to preview.</span>
										}
									</div>
								) : (
									<textarea
										value={eventDescription}
										onChange={(e) => setEventDescription(e.target.value)}
										className="w-full p-2 border rounded-lg"
										rows={3}
										placeholder="Supports markdown (e.g. **bold**, _italic_, bullet lists)"
									/>
								)}
							</div>
						</div>
					)}

					{/* Questionnaire Tab */}
					{activeTab === "questionnaire" && (
						<div>
							<div className="flex justify-between items-center mb-4">
								<p className="text-sm text-gray-500">
									Build the form applicants will fill out when applying to this event.
								</p>
								<button
									type="button"
									onClick={addQuestion}
									className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm transition-colors"
								>
									+ Add Question
								</button>
							</div>

							{questions.length === 0 ? (
								<div className="border-2 border-dashed border-gray-200 rounded-lg p-10 text-center text-gray-400">
									<p className="mb-2">No questions yet.</p>
									<p className="text-sm">Click "Add Question" to build your application form.</p>
								</div>
							) : (
								<div className="space-y-3">
									{questions.map((q, index) => (
										<div key={q.id} className="border border-gray-200 rounded-lg p-4">
											<div className="flex items-start gap-3">
												{/* Reorder buttons */}
												<div className="flex flex-col gap-1 pt-1 flex-shrink-0">
													<button
														type="button"
														onClick={() => moveQuestion(index, "up")}
														disabled={index === 0}
														className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed leading-none"
													>
														▲
													</button>
													<button
														type="button"
														onClick={() => moveQuestion(index, "down")}
														disabled={index === questions.length - 1}
														className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed leading-none"
													>
														▼
													</button>
												</div>

												{/* Question content */}
												<div className="flex-1 space-y-2">
													<input
														type="text"
														value={q.question_text}
														onChange={(e) =>
															updateQuestion(q.id, { question_text: e.target.value })
														}
														placeholder="Question label (e.g. Company name)"
														className="w-full p-2 border rounded-lg text-sm"
													/>
													<input
														type="text"
														value={q.description}
														onChange={(e) =>
															updateQuestion(q.id, { description: e.target.value })
														}
														placeholder="Description (optional helper text)"
														className="w-full p-2 border rounded-lg text-sm text-gray-500"
													/>
													<div className="flex items-center gap-3">
														<select
															value={q.question_type}
															onChange={(e) =>
																updateQuestion(q.id, {
																	question_type: e.target.value as QuestionDraft["question_type"],
																})
															}
															className="p-1.5 border rounded-lg text-sm text-gray-700"
														>
															{(Object.keys(questionTypeLabel) as QuestionDraft["question_type"][]).map((t) => (
																<option key={t} value={t}>
																	{questionTypeLabel[t]}
																</option>
															))}
														</select>

														<label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
															<input
																type="checkbox"
																checked={q.required}
																onChange={(e) =>
																	updateQuestion(q.id, { required: e.target.checked })
																}
																className="rounded"
															/>
															Required
														</label>
													</div>
												</div>

												{/* Remove */}
												<button
													type="button"
													onClick={() => removeQuestion(q.id)}
													className="text-red-400 hover:text-red-600 text-sm flex-shrink-0 mt-1"
												>
													Remove
												</button>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* Settings Tab */}
					{activeTab === "settings" && (
						<div>
							<div className="border rounded-lg p-4">
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-1">
											<span className="font-medium text-gray-800">
												Simple Commitment Mode
											</span>
											<div className="relative group">
												<svg
													className="w-4 h-4 text-gray-400 cursor-help flex-shrink-0"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
												<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
													<p className="font-semibold mb-1">Simple Commitment Mode</p>
													<ul className="list-disc ml-4 space-y-1 text-gray-300">
														<li>Hides the leaderboard tab from participants</li>
														<li>Investors commit a dollar amount instead of picking share quantities — shares and any unspent remainder are automatically returned</li>
														<li>Hides share prices and market cap from participants</li>
														<li>Admins get a private analytics tab with full market cap history and peak caps per founder</li>
													</ul>
													<div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
												</div>
											</div>
										</div>
										<p className="text-sm text-gray-500">
											{hideLeaderboardAndPrices
												? "Participants commit a dollar amount. Share prices and leaderboard are hidden. Admins have a private analytics view."
												: "Standard mode: participants see live share prices, market caps, and the leaderboard."}
										</p>
									</div>

									<button
										type="button"
										onClick={() => setHideLeaderboardAndPrices((v) => !v)}
										className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
											hideLeaderboardAndPrices ? "bg-blue-600" : "bg-gray-200"
										}`}
										role="switch"
										aria-checked={hideLeaderboardAndPrices}
									>
										<span
											className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
												hideLeaderboardAndPrices ? "translate-x-5" : "translate-x-0"
											}`}
										/>
									</button>
								</div>

								{hideLeaderboardAndPrices && (
									<div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
										<p className="font-medium mb-1">Simple Commitment Mode is ON</p>
										<p>
											Investors will enter a dollar amount to commit. The system
											automatically calculates shares based on current AMM pricing,
											returning any unused remainder.
										</p>
									</div>
								)}
							</div>
						</div>
					)}

					<div className="flex justify-end mt-8">
						<button
							type="submit"
							className={`px-5 py-2 rounded-lg ${
								isSubmitting
									? "bg-gray-400 cursor-not-allowed"
									: "bg-green-600 hover:bg-green-700"
							} text-white`}
							disabled={isSubmitting}
						>
							{isSubmitting
								? isEditMode ? "Saving..." : "Creating..."
								: isEditMode ? "Save Changes" : "Create Event"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};
