const path = require("path");

require("ts-node").register({
	project: path.resolve(__dirname, "../tsconfig.test.json"),
	transpileOnly: true,
	compilerOptions: {
		module: "commonjs",
		moduleResolution: "node",
	},
});

const allModule = require(path.resolve(__dirname, "./runAllTests.ts"));
if (allModule && typeof allModule.runAllTests === "function") {
	allModule.runAllTests().catch(console.error);
} else {
	console.error("Failed to load runAllTests from runAllTests.ts");
}
