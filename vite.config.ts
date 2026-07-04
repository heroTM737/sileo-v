import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// Dev (`vite`) serves the demo playground in /demo.
// Build (`vite build`) produces the distributable library from /src.
export default defineConfig({
	plugins: [
		vue(),
		dts({
			include: ["src"],
			rollupTypes: true,
			tsconfigPath: "./tsconfig.app.json",
		}),
	],
	resolve: {
		// Let the demo import the library as if it were the published package.
		alias: {
			"sileo-vue": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
		},
	},
	build: {
		lib: {
			entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
			name: "SileoVue",
			fileName: "sileo-vue",
			formats: ["es"],
		},
		rollupOptions: {
			// Vue and Motion are peer/externals — not bundled into the library.
			external: ["vue", "motion-v"],
			output: {
				globals: { vue: "Vue", "motion-v": "MotionV" },
				assetFileNames: "sileo-vue.[ext]",
			},
		},
	},
});
