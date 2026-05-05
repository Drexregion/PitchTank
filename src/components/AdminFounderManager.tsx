import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { Pitch, UpdatePitchRequest } from "../types/Pitch";

interface AdminPitchManagerProps {
	eventId: string;
	onProjectCreated?: () => void;
	onProjectUpdated?: () => void;
	onViewAnalytics?: (founder: Pitch) => void;
}

interface ApprovedApplication {
	id: string;
	applicant_email: string;
	answers: Record<string, string>;
	status: string;
}

const inputCls = "w-full p-2 bg-white border border-gray-200 text-gray-900 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const selectCls = "w-full p-2 bg-white border border-gray-200 text-gray-900 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export const AdminPitchManager: React.FC<AdminPitchManagerProps> = ({
	eventId,
	onProjectCreated,
	onProjectUpdated,
	onViewAnalytics,
}) => {
	const [tab, setTab] = useState<"create" | "manage">("manage");
	const [founders, setPitchs] = useState<Pitch[]>([]);
	const [approvedApps, setApprovedApps] = useState<ApprovedApplication[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	const [createForm, setCreateForm] = useState({
		name: "",
		bio: "",
		logo_url: "",
		pitch_summary: "",
		pitch_url: "",
		application_id: "",
	});

	const [editingId, setEditingId] = useState<string | null>(null);
	const [editForm, setEditForm] = useState<UpdatePitchRequest>({});
	const [isUploadingLogo, setIsUploadingLogo] = useState(false);
	const logoInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		fetchPitchs();
		fetchApprovedApps();
	}, [eventId]);

	const fetchPitchs = async () => {
		const { data } = await supabase
			.from("pitches")
			.select("*")
			.eq("event_id", eventId)
			.order("created_at", { ascending: true });
		if (data) setPitchs(data);
	};

	const fetchApprovedApps = async () => {
		const { data } = await supabase
			.from("applications")
			.select("id, applicant_email, answers, status")
			.eq("event_id", eventId)
			.order("submitted_at", { ascending: false });
		if (data) setApprovedApps(data);
	};

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!createForm.name.trim()) { setError("Project name is required"); return; }
		setIsLoading(true);
		setError(null);
		setSuccessMsg(null);

		const { error: err } = await supabase.from("pitches").insert({
			event_id: eventId,
			profile_user_id: null,
			application_id: createForm.application_id || null,
			name: createForm.name,
			bio: createForm.bio || null,
			logo_url: createForm.logo_url || null,
			pitch_summary: createForm.pitch_summary || null,
			pitch_url: createForm.pitch_url || null,
			shares_in_pool: 100000,
			cash_in_pool: 1000000,
			k_constant: 100000000000,
			min_reserve_shares: 1000,
		});

		if (err) { setError(err.message); }
		else {
			setSuccessMsg("Pitcher slot created.");
			setCreateForm({ name: "", bio: "", logo_url: "", pitch_summary: "", pitch_url: "", application_id: "" });
			await fetchPitchs();
			setTab("manage");
			onProjectCreated?.();
		}
		setIsLoading(false);
	};

	const handleUpdate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingId) return;
		setIsLoading(true);
		setError(null);

		const { error: err } = await supabase
			.from("pitches")
			.update(editForm)
			.eq("id", editingId);

		if (err) { setError(err.message); }
		else {
			setEditingId(null);
			setEditForm({});
			await fetchPitchs();
			onProjectUpdated?.();
		}
		setIsLoading(false);
	};

	const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !editingId) return;
		if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
		if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5 MB."); return; }
		setIsUploadingLogo(true);
		setError(null);
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { setError("Not authenticated."); setIsUploadingLogo(false); return; }
		const ext = file.name.split(".").pop();
		const path = `${user.id}/pitch-logo-${editingId}.${ext}`;
		const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
		if (uploadError) { setError("Upload failed: " + uploadError.message); setIsUploadingLogo(false); return; }
		const { data } = supabase.storage.from("avatars").getPublicUrl(path);
		setEditForm(p => ({ ...p, logo_url: `${data.publicUrl}?t=${Date.now()}` }));
		setIsUploadingLogo(false);
	};

	const appDropdown = (value: string, onChange: (val: string) => void) => (
		<div className="col-span-2">
			<label className="block text-xs font-medium text-gray-500 mb-1">Linked Application</label>
			<select value={value} onChange={e => onChange(e.target.value)} className={selectCls}>
				<option value="">— none —</option>
				{approvedApps.map(a => (
					<option key={a.id} value={a.id}>{a.applicant_email} ({a.status})</option>
				))}
			</select>
		</div>
	);

	return (
		<div className="border-t border-gray-100 pt-4 mt-4">
			{/* Tab bar */}
			<div className="flex gap-2 mb-4">
				{(["manage", "create"] as const).map((t) => (
					<button
						key={t}
						onClick={() => { setTab(t); setError(null); setSuccessMsg(null); }}
						className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
							tab === t
								? "bg-blue-600 text-white border-blue-600"
								: "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
						}`}
					>
						{t === "manage" ? `Pitchers (${founders.length})` : "+ New Pitcher"}
					</button>
				))}
			</div>

			{error && <p className="text-xs text-red-600 mb-2">{error}</p>}
			{successMsg && <p className="text-xs text-green-600 mb-2">{successMsg}</p>}

			{/* CREATE TAB */}
			{tab === "create" && (
				<form onSubmit={handleCreate} className="space-y-3">
					<div className="grid grid-cols-2 gap-3">
						<div className="col-span-2">
							<label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
							<input type="text" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="Startup / company name" />
						</div>
						<div className="col-span-2">
							<label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
							<textarea value={createForm.bio} onChange={e => setCreateForm(p => ({ ...p, bio: e.target.value }))} className={inputCls} rows={2} placeholder="One-liner or elevator pitch..." />
						</div>
						<div>
							<label className="block text-xs font-medium text-gray-500 mb-1">Logo URL</label>
							<input type="url" value={createForm.logo_url} onChange={e => setCreateForm(p => ({ ...p, logo_url: e.target.value }))} className={inputCls} placeholder="https://..." />
						</div>
						<div>
							<label className="block text-xs font-medium text-gray-500 mb-1">Pitch URL</label>
							<input type="url" value={createForm.pitch_url} onChange={e => setCreateForm(p => ({ ...p, pitch_url: e.target.value }))} className={inputCls} placeholder="https://..." />
						</div>
						<div className="col-span-2">
							<label className="block text-xs font-medium text-gray-500 mb-1">Pitch Summary</label>
							<textarea value={createForm.pitch_summary} onChange={e => setCreateForm(p => ({ ...p, pitch_summary: e.target.value }))} className={inputCls} rows={2} placeholder="2-3 sentence pitch..." />
						</div>
						{appDropdown(createForm.application_id, val => setCreateForm(p => ({ ...p, application_id: val })))}
					</div>
					<p className="text-xs text-gray-400">AMM defaults: 100k shares · $1M cash · k=100B · 1k min reserve</p>
					<div className="flex gap-2">
						<button type="submit" disabled={isLoading} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
							{isLoading ? "Creating..." : "Create Pitcher Slot"}
						</button>
						<button type="button" onClick={() => setTab("manage")} className="px-4 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
							Cancel
						</button>
					</div>
				</form>
			)}

			{/* MANAGE TAB */}
			{tab === "manage" && (
				<div className="space-y-3">
					{founders.length === 0 ? (
						<p className="text-xs text-gray-400 py-2">No pitcher slots yet. Create one above.</p>
					) : (
						founders.map((f) => {
							const linkedApp = approvedApps.find(a => a.id === f.application_id);
							const isEditing = editingId === f.id;

							return (
								<div key={f.id} className="rounded-lg border border-gray-200 bg-gray-50 p3">
									{isEditing ? (
										<form onSubmit={handleUpdate} className="space-y-2 p-3">
											<div className="grid grid-cols-2 gap-2">
												<div className="col-span-2">
													<label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
													<input type="text" value={editForm.name ?? ""} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className={inputCls} />
												</div>
												<div>
													<label className="block text-xs font-medium text-gray-500 mb-1">Logo Image</label>
													<div className="flex items-center gap-2">
														<button
															type="button"
															onClick={() => logoInputRef.current?.click()}
															disabled={isUploadingLogo}
															className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:border-gray-400 text-gray-600 disabled:opacity-50 flex-shrink-0"
														>
															{isUploadingLogo ? (
																<svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
															) : (
																<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
															)}
															{isUploadingLogo ? "Uploading…" : "Upload"}
														</button>
														{editForm.logo_url && (
															<img src={editForm.logo_url} alt="" className="w-7 h-7 rounded object-cover border border-gray-200 flex-shrink-0" />
														)}
														<input type="url" value={editForm.logo_url ?? ""} onChange={e => setEditForm(p => ({ ...p, logo_url: e.target.value }))} className={inputCls} placeholder="or paste URL" />
													</div>
													<input ref={logoInputRef} type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} disabled={isUploadingLogo} />
												</div>
												<div>
													<label className="block text-xs font-medium text-gray-500 mb-1">Pitch URL</label>
													<input type="url" value={editForm.pitch_url ?? ""} onChange={e => setEditForm(p => ({ ...p, pitch_url: e.target.value }))} className={inputCls} />
												</div>
												<div className="col-span-2">
													<label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
													<textarea value={editForm.bio ?? ""} onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))} className={inputCls} rows={2} />
												</div>
												<div className="col-span-2">
													<label className="block text-xs font-medium text-gray-500 mb-1">Pitch Summary</label>
													<textarea value={editForm.pitch_summary ?? ""} onChange={e => setEditForm(p => ({ ...p, pitch_summary: e.target.value }))} className={inputCls} rows={2} />
												</div>
												{appDropdown(
													editForm.application_id ?? "",
													val => setEditForm(p => ({ ...p, application_id: val || null }))
												)}
											</div>
											<div className="flex gap-2">
												<button type="submit" disabled={isLoading} className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
													{isLoading ? "Saving..." : "Save"}
												</button>
												<button type="button" onClick={() => { setEditingId(null); setEditForm({}); }} className="px-3 py-1 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-white">
													Cancel
												</button>
											</div>
										</form>
									) : (
										<div className="p-3">
											<div className="flex items-start justify-between gap-2">
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														{f.logo_url && <img src={f.logo_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />}
														<p className="text-sm font-semibold text-gray-900 truncate">{f.name}</p>
													</div>
													{f.bio && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{f.bio}</p>}
													<p className="text-xs text-gray-400 mt-1">
														{(f.cash_in_pool / f.shares_in_pool).toFixed(4)} $/share · {f.shares_in_pool.toLocaleString()} shares
													</p>
													{linkedApp && (
														<p className="text-xs text-gray-400 mt-0.5">
															Linked to <span className="text-gray-600 font-medium">{linkedApp.applicant_email}</span>
														</p>
													)}
												</div>
												<div className="flex gap-1.5 flex-shrink-0">
													{onViewAnalytics && (
														<button onClick={() => onViewAnalytics(f)} className="px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50">
															Analytics
														</button>
													)}
													<button
														onClick={() => {
															setEditingId(f.id);
															setEditForm({
																name: f.name,
																bio: f.bio,
																logo_url: f.logo_url,
																pitch_summary: f.pitch_summary,
																pitch_url: f.pitch_url,
																application_id: f.application_id ?? null,
															});
														}}
														className="px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded hover:bg-white"
													>
														Edit
													</button>
												</div>
											</div>
										</div>
									)}
								</div>
							);
						})
					)}
				</div>
			)}
		</div>
	);
};
