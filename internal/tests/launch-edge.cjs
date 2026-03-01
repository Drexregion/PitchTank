const path = require("path");

require("ts-node").register({
	project: path.resolve(__dirname, "../tsconfig.test.json"),
	transpileOnly: true,
	compilerOptions: {
		module: "commonjs",
		moduleResolution: "node",
	},
});

const edgeModule = require(path.resolve(__dirname, "./edgeCaseTests.ts"));
if (edgeModule && typeof edgeModule.runAllEdgeCaseTests === "function") {
	edgeModule.runAllEdgeCaseTests().catch(console.error);
} else {
	console.error("Failed to load runAllEdgeCaseTests from edgeCaseTests.ts");
}
