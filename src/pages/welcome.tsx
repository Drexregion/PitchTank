import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button as PtButton, IridescentArc } from "../components/design-system";

const WelcomePage: React.FC = () => {
	const navigate = useNavigate();
	const { user, isLoading: authLoading } = useAuth();

	// If already signed in, skip the welcome screen entirely.
	if (!authLoading && user) {
		return <Navigate to="/" replace />;
	}

	return (
		<div
			className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-6 py-12"
			style={{ background: "#080a14" }}
		>
			{/* Background image */}
			<div
				aria-hidden="true"
				className="fixed inset-0 bg-cover bg-center bg-no-repeat"
				style={{ backgroundImage: "url('/leaderboard/leaderboard-bg.webp')" }}
			/>
			{/* Dark overlay */}
			<div
				aria-hidden="true"
				className="fixed inset-0"
				style={{
					background:
						"linear-gradient(160deg, rgba(6,12,28,0.88) 0%, rgba(8,16,40,0.82) 50%, rgba(4,10,24,0.90) 100%)",
				}}
			/>
			{/* Ambient glows */}
			<div
				aria-hidden="true"
				className="fixed inset-0 pointer-events-none overflow-hidden"
			>
				<div
					className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[60vh] rounded-full opacity-60"
					style={{
						background:
							"radial-gradient(ellipse at center, #2d1b69 0%, #1a0e4a 35%, transparent 70%)",
					}}
				/>
				<div
					className="absolute top-1/3 -left-20 w-72 h-72 rounded-full opacity-25"
					style={{
						background:
							"radial-gradient(circle, #4f46e5 0%, transparent 70%)",
						filter: "blur(40px)",
					}}
				/>
				<div
					className="absolute top-1/2 -right-20 w-72 h-72 rounded-full opacity-20"
					style={{
						background:
							"radial-gradient(circle, #0ea5e9 0%, transparent 70%)",
						filter: "blur(50px)",
					}}
				/>
			</div>

			<div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center">
				<div className="welcome-logo-wrap mb-6">
					<div className="welcome-logo-glow" aria-hidden="true" />
					<img
						src="/leaderboard/logo.png"
						alt="PitchTank"
						className="welcome-logo-img"
					/>
				</div>

				<IridescentArc className="w-3/4 mb-4" />

				<h1
					className="font-display font-semibold text-white text-[28px] leading-tight tracking-tight"
					style={{ textShadow: "0 0 18px rgba(184,212,255,0.35)" }}
				>
					Welcome to PitchTank
				</h1>
				<p
					className="text-pt-text-2 text-sm mt-2 mb-10 max-w-[28ch]"
				>
					The new way to discover and connect with founders.
				</p>

				<PtButton
					variant="primary"
					size="lg"
					className="w-full"
					onClick={() => navigate("/login")}
				>
					Enter PitchTank
				</PtButton>
			</div>

			<style>{`
				.welcome-logo-wrap {
					position: relative;
					width: 240px;
					height: 150px;
					display: flex;
					align-items: center;
					justify-content: center;
				}
				.welcome-logo-glow {
					position: absolute;
					inset: -22px;
					border-radius: 50%;
					background:
						radial-gradient(ellipse at center, rgba(162,89,255,0.45) 0%, rgba(79,124,255,0.20) 35%, transparent 70%);
					filter: blur(18px);
					opacity: 0.85;
					animation: welcome-breathe 3.2s ease-in-out infinite;
				}
				.welcome-logo-img {
					position: relative;
					z-index: 1;
					width: 100%;
					height: 100%;
					object-fit: contain;
					filter:
						drop-shadow(0 0 22px rgba(162,89,255,0.50))
						drop-shadow(0 0 12px rgba(34,211,238,0.30));
					animation: welcome-fade-in 700ms cubic-bezier(0.22, 1, 0.36, 1);
				}
				@keyframes welcome-breathe {
					0%, 100% { opacity: 0.65; transform: scale(1); }
					50%      { opacity: 1;    transform: scale(1.06); }
				}
				@keyframes welcome-fade-in {
					from { opacity: 0; transform: translateY(6px) scale(0.96); }
					to   { opacity: 1; transform: translateY(0) scale(1); }
				}
			`}</style>
		</div>
	);
};

export default WelcomePage;
