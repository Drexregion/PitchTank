import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Event } from "../types/Event";

interface EventSetupFormProps {
	onEventCreated?: (event: Event) => void;
}

interface FounderInput {
	name: string;
	bio: string;
	pitch_summary: string;
	logo_url: string;
}

export const EventSetupForm: React.FC<EventSetupFormProps> = ({
	onEventCreated,
}) => {
	// Event form state
	const [eventName, setEventName] = useState<string>("");
	const [eventDescription, setEventDescription] = useState<string>("");
	const [startTime, setStartTime] = useState<string>("");
	const [endTime, setEndTime] = useState<string>("");

	// Founders form state
	const [founders, setFounders] = useState<FounderInput[]>([
		{ name: "", bio: "", pitch_summary: "", logo_url: "" },
	]);

	// Form status
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Add a new founder input row
	const addFounder = () => {
		setFounders([
			...founders,
			{ name: "", bio: "", pitch_summary: "", logo_url: "" },
		]);
	};

	// Remove a founder input row
	const removeFounder = (index: number) => {
		if (founders.length <= 1) return;
		const newFounders = [...founders];
		newFounders.splice(index, 1);
		setFounders(newFounders);
	};

	// Update a founder input field
	const updateFounder = (
		index: number,
		field: keyof FounderInput,
		value: string
	) => {
		const newFounders = [...founders];
		newFounders[index] = {
			...newFounders[index],
			[field]: value,
		};
		setFounders(newFounders);
	};

	// Submit the form
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setError(null);
		setSuccess(null);

		try {
			// Validate inputs
			if (!eventName || !startTime || !endTime) {
				throw new Error("Please fill in all required event fields");
			}

			if (new Date(startTime) >= new Date(endTime)) {
				throw new Error("End time must be after start time");
			}

			if (founders.some((f) => !f.name)) {
				throw new Error("All founders must have a name");
			}

			// Create event
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

			// Create event settings with default values
			const { error: settingsError } = await supabase
				.from("event_settings")
				.insert({
					event_id: eventData.id,
					snapshot_interval_seconds: 60,
					max_price_history_points: 10000,
				});

			if (settingsError) throw settingsError;

			// Create founders
			const foundersToInsert = founders.map((founder) => ({
				event_id: eventData.id,
				name: founder.name,
				bio: founder.bio || null,
				pitch_summary: founder.pitch_summary || null,
				logo_url: founder.logo_url || null,
				shares_in_pool: 100000,
				cash_in_pool: 10000000,
				k_constant: 100000 * 10000000,
			}));

			const { error: foundersError } = await supabase
				.from("founders")
				.insert(foundersToInsert);

			if (foundersError) throw foundersError;

			// Success
			setSuccess(
				`Event "${eventName}" created successfully with ${founders.length} founders!`
			);

			// Reset form
			setEventName("");
			setEventDescription("");
			setStartTime("");
			setEndTime("");
			setFounders([{ name: "", bio: "", pitch_summary: "", logo_url: "" }]);

			// Call the callback
			if (onEventCreated) {
				onEventCreated(eventData);
			}
		} catch (err: any) {
			setError(err.message || "An error occurred while creating the event");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="bg-white rounded-xl shadow-md overflow-hidden">
			<div className="p-6">
				<h2 className="text-2xl font-bold mb-6">Create New Event</h2>

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

				<form onSubmit={handleSubmit}>
					<div className="mb-8">
						<h3 className="text-lg font-semibold mb-4">Event Details</h3>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
							<label className="block text-gray-700 mb-1">
								Event Description
							</label>
							<textarea
								value={eventDescription}
								onChange={(e) => setEventDescription(e.target.value)}
								className="w-full p-2 border rounded-lg"
								rows={3}
							/>
						</div>
					</div>

					<div className="mb-8">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-semibold">Founders</h3>
							<button
								type="button"
								onClick={addFounder}
								className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Add Founder
							</button>
						</div>

						{founders.map((founder, index) => (
							<div key={index} className="border rounded-lg p-4 mb-4">
								<div className="flex justify-between items-center mb-3">
									<h4 className="font-medium">Founder #{index + 1}</h4>
									{founders.length > 1 && (
										<button
											type="button"
											onClick={() => removeFounder(index)}
											className="text-red-600 hover:text-red-800"
										>
											Remove
										</button>
									)}
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-gray-700 mb-1">
											Founder Name <span className="text-red-500">*</span>
										</label>
										<input
											type="text"
											value={founder.name}
											onChange={(e) =>
												updateFounder(index, "name", e.target.value)
											}
											className="w-full p-2 border rounded-lg"
											required
										/>
									</div>

									<div>
										<label className="block text-gray-700 mb-1">Logo URL</label>
										<input
											type="url"
											value={founder.logo_url}
											onChange={(e) =>
												updateFounder(index, "logo_url", e.target.value)
											}
											className="w-full p-2 border rounded-lg"
											placeholder="https://example.com/logo.png"
										/>
									</div>
								</div>

								<div className="mt-3">
									<label className="block text-gray-700 mb-1">Bio</label>
									<textarea
										value={founder.bio}
										onChange={(e) =>
											updateFounder(index, "bio", e.target.value)
										}
										className="w-full p-2 border rounded-lg"
										rows={2}
									/>
								</div>

								<div className="mt-3">
									<label className="block text-gray-700 mb-1">
										Pitch Summary
									</label>
									<textarea
										value={founder.pitch_summary}
										onChange={(e) =>
											updateFounder(index, "pitch_summary", e.target.value)
										}
										className="w-full p-2 border rounded-lg"
										rows={2}
									/>
								</div>

								<div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
									<p>Each founder will start with:</p>
									<ul className="list-disc ml-5 mt-1">
										<li>100,000 shares in pool</li>
										<li>$1,000,000 cash in pool</li>
										<li>Initial share price: $10.00</li>
									</ul>
								</div>
							</div>
						))}
					</div>

					<div className="flex justify-end">
						<button
							type="submit"
							className={`px-5 py-2 rounded-lg ${
								isSubmitting
									? "bg-gray-400 cursor-not-allowed"
									: "bg-green-600 hover:bg-green-700"
							} text-white`}
							disabled={isSubmitting}
						>
							{isSubmitting ? "Creating..." : "Create Event"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};
