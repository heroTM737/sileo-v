<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { DEFAULT_TOAST_DURATION } from "./constants";
import Sileo from "./Sileo.vue";
import { expandDir, pillAlign, type SileoItem, sileo, store } from "./toast";
import type { SileoOptions, SileoPosition } from "./types";

type SileoOffsetValue = number | string;
type SileoOffsetConfig = Partial<
	Record<"top" | "right" | "bottom" | "left", SileoOffsetValue>
>;

const props = withDefaults(
	defineProps<{
		position?: SileoPosition;
		offset?: SileoOffsetValue | SileoOffsetConfig;
		options?: Partial<SileoOptions>;
		theme?: "light" | "dark" | "system";
	}>(),
	{ position: "top-right" },
);

const THEME_FILLS = {
	light: "#1a1a1a",
	dark: "#f2f2f2",
} as const;

/* ------------------------------ Resolved theme ---------------------------- */

const resolvedTheme = ref<"light" | "dark">(
	props.theme === "light" || props.theme === "dark"
		? props.theme
		: typeof window === "undefined"
			? "light"
			: window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light",
);

let mq: MediaQueryList | null = null;
const mqHandler = (e: MediaQueryListEvent) => {
	resolvedTheme.value = e.matches ? "dark" : "light";
};

const setupTheme = () => {
	if (mq) {
		mq.removeEventListener("change", mqHandler);
		mq = null;
	}
	if (props.theme === "light" || props.theme === "dark") {
		resolvedTheme.value = props.theme;
		return;
	}
	if (typeof window === "undefined") return;
	mq = window.matchMedia("(prefers-color-scheme: dark)");
	resolvedTheme.value = mq.matches ? "dark" : "light";
	mq.addEventListener("change", mqHandler);
};

onMounted(setupTheme);
watch(() => props.theme, setupTheme);

/* -------------------------------- Toasts ---------------------------------- */

const toasts = computed(() => store.toasts.value);
const activeId = ref<string>();

let hover = false;
const timers = new Map<string, number>();
const timeoutKey = (t: SileoItem) => `${t.id}:${t.instanceId}`;

const clearAllTimers = () => {
	for (const t of timers.values()) clearTimeout(t);
	timers.clear();
};

const schedule = (items: SileoItem[]) => {
	if (hover) return;
	for (const item of items) {
		if (item.exiting) continue;
		const key = timeoutKey(item);
		if (timers.has(key)) continue;
		if (item.duration === null) continue;
		const dur = item.duration ?? DEFAULT_TOAST_DURATION;
		if (dur <= 0) continue;
		timers.set(
			key,
			window.setTimeout(() => sileo.dismiss(item.id), dur),
		);
	}
};

// Keep the store in sync with the mounted Toaster's defaults.
watch(
	() => [props.position, props.options] as const,
	() => {
		store.position = props.position;
		store.options = props.options;
	},
	{ immediate: true },
);

// Reconcile timers as toasts appear/disappear, then (re)schedule dismissals.
watch(
	toasts,
	(list) => {
		const toastKeys = new Set(list.map(timeoutKey));
		for (const [key, timer] of timers) {
			if (!toastKeys.has(key)) {
				clearTimeout(timer);
				timers.delete(key);
			}
		}
		schedule(list);
	},
	{ immediate: true },
);

const latest = computed(() => {
	for (let i = toasts.value.length - 1; i >= 0; i--) {
		if (!toasts.value[i].exiting) return toasts.value[i].id;
	}
	return undefined;
});

watch(latest, (l) => {
	activeId.value = l;
}, { immediate: true });

/* -------------------------------- Handlers -------------------------------- */

const onEnter = (item: SileoItem) => {
	activeId.value = item.id;
	if (!hover) {
		hover = true;
		clearAllTimers();
	}
};

const onLeave = () => {
	activeId.value = latest.value;
	if (hover) {
		hover = false;
		schedule(toasts.value);
	}
};

const onDismiss = (id: string) => sileo.dismiss(id);

/* ------------------------------- Viewports -------------------------------- */

const px = (v: SileoOffsetValue) => (typeof v === "number" ? `${v}px` : v);

const getViewportStyle = (
	pos: SileoPosition,
): Record<string, string> | undefined => {
	if (props.offset === undefined) return undefined;

	const o =
		typeof props.offset === "object"
			? props.offset
			: {
					top: props.offset,
					right: props.offset,
					bottom: props.offset,
					left: props.offset,
				};

	const s: Record<string, string> = {};
	if (pos.startsWith("top") && o.top) s.top = px(o.top);
	if (pos.startsWith("bottom") && o.bottom) s.bottom = px(o.bottom);
	if (pos.endsWith("left") && o.left) s.left = px(o.left);
	if (pos.endsWith("right") && o.right) s.right = px(o.right);

	return s;
};

const positionEntries = computed(() => {
	const map = new Map<SileoPosition, SileoItem[]>();
	for (const t of toasts.value) {
		const pos = t.position ?? props.position;
		const arr = map.get(pos);
		if (arr) {
			arr.push(t);
		} else {
			map.set(pos, [t]);
		}
	}
	return Array.from(map);
});

onBeforeUnmount(() => {
	if (mq) mq.removeEventListener("change", mqHandler);
	clearAllTimers();
});
</script>

<template>
	<slot />
	<section
		v-for="[pos, items] in positionEntries"
		:key="pos"
		data-sileo-viewport
		:data-position="pos"
		:data-theme="theme ? resolvedTheme : undefined"
		aria-live="polite"
		:style="getViewportStyle(pos)"
	>
		<Sileo
			v-for="item in items"
			:key="item.id"
			:id="item.id"
			:state="item.state"
			:title="item.title"
			:description="item.description"
			:position="pillAlign(pos)"
			:expand="expandDir(pos)"
			:icon="item.icon"
			:fill="item.fill ?? (theme ? THEME_FILLS[resolvedTheme] : undefined)"
			:styles="item.styles"
			:button="item.button"
			:roundness="item.roundness"
			:exiting="item.exiting"
			:auto-expand-delay-ms="item.autoExpandDelayMs"
			:auto-collapse-delay-ms="item.autoCollapseDelayMs"
			:refresh-key="item.instanceId"
			:can-expand="activeId === undefined || activeId === item.id"
			@hoverenter="onEnter(item)"
			@hoverleave="onLeave()"
			@dismiss="onDismiss(item.id)"
		/>
	</section>
</template>
