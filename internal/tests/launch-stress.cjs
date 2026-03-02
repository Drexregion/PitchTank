const path = require("path");

require("ts-node").register({
	project: path.resolve(__dirname, "../tsconfig.test.json"),
	transpileOnly: true,
	compilerOptions: {
		module: "commonjs",
		moduleResolution: "node",
	},
});

require(path.resolve(__dirname, "./stressTest.ts"));
