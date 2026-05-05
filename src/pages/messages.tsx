import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { ConversationsPanel } from "../components/ConversationsPanel";
import { DMPanel } from "../components/DMPanel";

const MessagesPage: React.FC = () => {
	const { peerId } = useParams<{ peerId?: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const { user } = useAuth();

	const peerName: string = (location.state as any)?.peerName ?? "";

	const [displayName, setDisplayName] = useState("");

	useEffect(() => {
		if (!user) return;
		supabase
			.from("users")
			.select("first_name, last_name")
			.eq("auth_user_id", user.id)
			.maybeSingle()
			.then(({ data }) => {
				const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ");
				setDisplayName(name || user.email?.split("@")[0] || "Me");
			});
	}, [user]);

	if (!user) {
		return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
	}

	return (
		<div style={{ background: "#080a14", minHeight: "100vh" }}>
			<ConversationsPanel
				isOpen={!peerId}
				onClose={() => navigate("/")}
				userId={user.id}
				displayName={displayName}
				onOpenDM={(pid, pName) =>
					navigate(`/messages/dm/${pid}`, { state: { peerName: pName } })
				}
			/>

			<DMPanel
				isOpen={!!peerId}
				onClose={() => navigate("/messages")}
				onBack={() => navigate("/messages")}
				userId={user.id}
				displayName={displayName}
				peerId={peerId ?? ""}
				peerName={peerName}
			/>
		</div>
	);
};

export default MessagesPage;
