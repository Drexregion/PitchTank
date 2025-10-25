/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				// Fancy dark blue theme
				primary: {
					50: "#e6f0ff",
					100: "#b3d4ff",
					200: "#80b8ff",
					300: "#4d9cff",
					400: "#1a80ff",
					500: "#0066e6",
					600: "#0052b3",
					700: "#003d80",
					800: "#00294d",
					900: "#00141a",
					950: "#000a0d",
				},
				dark: {
					50: "#e8edf5",
					100: "#c5d2e5",
					200: "#a1b7d5",
					300: "#7d9cc5",
					400: "#5981b5",
					500: "#3f669b",
					600: "#324f78",
					700: "#253955",
					800: "#182332",
					900: "#0b0d0f",
					950: "#060809",
				},
				accent: {
					cyan: "#00d4ff",
					blue: "#0099ff",
					purple: "#6366f1",
					pink: "#ec4899",
				},
			},
			backgroundImage: {
				"gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
				"gradient-dark":
					"linear-gradient(135deg, #0b0d0f 0%, #182332 50%, #253955 100%)",
				"gradient-primary":
					"linear-gradient(135deg, #0052b3 0%, #0066e6 50%, #1a80ff 100%)",
			},
			boxShadow: {
				glow: "0 0 15px rgba(0, 212, 255, 0.5)",
				"glow-lg": "0 0 30px rgba(0, 212, 255, 0.6)",
			},
		},
	},
	plugins: [],
};
