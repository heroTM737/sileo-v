<script setup lang="ts">
import { ref } from "vue";
import { sileo, type SileoPosition, Toaster } from "sileo-vue";

const position = ref<SileoPosition>("top-right");
const theme = ref<"light" | "dark" | "system">("system");

const positions: SileoPosition[] = [
	"top-left",
	"top-center",
	"top-right",
	"bottom-left",
	"bottom-center",
	"bottom-right",
];

const basic = [
	{ label: "Success", run: () => sileo.success({ title: "Saved" }) },
	{ label: "Error", run: () => sileo.error({ title: "Something broke" }) },
	{ label: "Warning", run: () => sileo.warning({ title: "Heads up" }) },
	{ label: "Info", run: () => sileo.info({ title: "New update available" }) },
	{ label: "Action", run: () => sileo.action({ title: "Review changes" }) },
	{
		label: "Loading",
		run: () => sileo.show({ type: "loading", title: "Working", duration: null }),
	},
];

const withDescription = () =>
	sileo.success({
		title: "Payment received",
		description:
			"Your subscription is active until July 2027. A receipt has been emailed to you.",
	});

const withButton = () =>
	sileo.action({
		title: "Update ready",
		description: "Version 2.0 is available to install.",
		button: {
			title: "Install now",
			onClick: () => sileo.success({ title: "Installing…" }),
		},
	});

const runPromise = () =>
	sileo.promise(
		new Promise((resolve, reject) =>
			setTimeout(() => (Math.random() > 0.35 ? resolve("ok") : reject()), 2200),
		),
		{
			loading: { title: "Uploading" },
			success: { title: "Uploaded", description: "3 files synced to the cloud." },
			error: { title: "Upload failed", description: "Please try again." },
		},
	);
</script>

<template>
	<Toaster :position="position" :theme="theme" />

	<main>
		<header>
			<h1>Sileo <span>· Vue</span></h1>
			<p>An opinionated, physics-based toast component. Ported to Vue 3.</p>
		</header>

		<section class="controls">
			<label>
				Position
				<select v-model="position">
					<option v-for="p in positions" :key="p" :value="p">{{ p }}</option>
				</select>
			</label>
			<label>
				Theme
				<select v-model="theme">
					<option value="system">system</option>
					<option value="light">light</option>
					<option value="dark">dark</option>
				</select>
			</label>
		</section>

		<section class="grid">
			<button
				v-for="b in basic"
				:key="b.label"
				type="button"
				@click="b.run"
			>
				{{ b.label }}
			</button>
		</section>

		<section class="grid">
			<button type="button" @click="withDescription">With description</button>
			<button type="button" @click="withButton">With action button</button>
			<button type="button" @click="runPromise">Promise</button>
			<button type="button" class="ghost" @click="() => sileo.clear()">
				Dismiss all
			</button>
		</section>
	</main>
</template>
