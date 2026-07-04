<script setup lang="ts">
import { motion } from "motion-v";
import {
	computed,
	type FunctionalComponent,
	h,
	onBeforeUnmount,
	onMounted,
	ref,
	type VNodeChild,
	watch,
	watchEffect,
} from "vue";
import {
	BLUR_RATIO,
	DEFAULT_ROUNDNESS,
	HEADER_EXIT_MS,
	HEIGHT,
	MIN_EXPAND_RATIO,
	PILL_PADDING,
	SPRING,
	SWAP_COLLAPSE_MS,
	WIDTH,
} from "./constants";
import {
	ArrowRight,
	Check,
	CircleAlert,
	LifeBuoy,
	LoaderCircle,
	X,
} from "./icons";
import { RenderNode } from "./render";
import type { SileoButton, SileoNode, SileoState, SileoStyles } from "./types";

type State = SileoState;

interface View {
	title?: string;
	description?: SileoNode | string;
	state: State;
	icon?: SileoNode | null;
	styles?: SileoStyles;
	button?: SileoButton;
	fill: string;
}

const props = withDefaults(
	defineProps<{
		id: string;
		fill?: string;
		state?: State;
		title?: string;
		description?: SileoNode | string;
		position?: "left" | "center" | "right";
		expand?: "top" | "bottom";
		icon?: SileoNode | null;
		styles?: SileoStyles;
		button?: SileoButton;
		roundness?: number;
		exiting?: boolean;
		autoExpandDelayMs?: number;
		autoCollapseDelayMs?: number;
		canExpand?: boolean;
		interruptKey?: string;
		refreshKey?: string;
	}>(),
	{
		fill: "#FFFFFF",
		state: "success",
		position: "left",
		expand: "bottom",
		exiting: false,
	},
);

const emit = defineEmits<{
	hoverenter: [MouseEvent];
	hoverleave: [MouseEvent];
	dismiss: [];
}>();

/* ---------------------------------- Icons --------------------------------- */

const STATE_ICON: Record<State, () => VNodeChild> = {
	success: () => h(Check),
	loading: () => h(LoaderCircle, { "data-sileo-icon": "spin", "aria-hidden": "true" }),
	error: () => h(X),
	warning: () => h(CircleAlert),
	info: () => h(LifeBuoy),
	action: () => h(ArrowRight),
};

/* ----------------------------- Gooey filter defs -------------------------- */

const GooeyDefs: FunctionalComponent<{ filterId: string; blur: number }> = (
	defsProps,
) =>
	h("defs", [
		h(
			"filter",
			{
				id: defsProps.filterId,
				x: "-20%",
				y: "-20%",
				width: "140%",
				height: "140%",
				"color-interpolation-filters": "sRGB",
			},
			[
				h("feGaussianBlur", {
					in: "SourceGraphic",
					stdDeviation: defsProps.blur,
					result: "blur",
				}),
				h("feColorMatrix", {
					in: "blur",
					mode: "matrix",
					values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10",
					result: "goo",
				}),
				h("feComposite", {
					in: "SourceGraphic",
					in2: "goo",
					operator: "atop",
				}),
			],
		),
	]);

// Declaring props lets Vue map the kebab-cased `filter-id` attribute onto the
// camelCased `filterId` the render function reads (functional components skip
// this conversion otherwise).
GooeyDefs.props = ["filterId", "blur"];

/* ------------------------------- Reactive view ---------------------------- */

const resolvedTitle = computed(() => props.title ?? props.state);
const next = computed<View>(() => ({
	title: resolvedTitle.value,
	description: props.description,
	state: props.state,
	icon: props.icon,
	styles: props.styles,
	button: props.button,
	fill: props.fill,
}));

const view = ref<View>({ ...next.value });
const applied = ref<string | undefined>(props.refreshKey);
const isExpanded = ref(false);
const ready = ref(false);
const pillWidth = ref(0);
const contentHeight = ref(0);

const hasDesc = computed(
	() => Boolean(view.value.description) || Boolean(view.value.button),
);
const isLoading = computed(() => view.value.state === "loading");
const open = computed(() => hasDesc.value && isExpanded.value && !isLoading.value);
const allowExpand = computed(() =>
	isLoading.value
		? false
		: (props.canExpand ?? (!props.interruptKey || props.interruptKey === props.id)),
);

const headerKey = computed(() => `${view.value.state}-${view.value.title}`);
const filterId = computed(() => `sileo-gooey-${props.id}`);
const resolvedRoundness = computed(() =>
	Math.max(0, props.roundness ?? DEFAULT_ROUNDNESS),
);
const blur = computed(() => resolvedRoundness.value * BLUR_RATIO);

const headerLayer = ref<{
	current: { key: string; view: View };
	prev: { key: string; view: View } | null;
}>({ current: { key: headerKey.value, view: view.value }, prev: null });

/* --------------------------- Mutable (non-reactive) ----------------------- */

const headerEl = ref<HTMLDivElement>();
const contentEl = ref<HTMLDivElement>();
const innerEl = ref<HTMLDivElement>();
const buttonEl = ref<HTMLButtonElement>();

let headerExitTimer: number | null = null;
let autoExpandTimer: number | null = null;
let autoCollapseTimer: number | null = null;
let swapTimer: number | null = null;
let lastRefreshKey = props.refreshKey;
let pending: { key?: string; payload: View } | null = null;
let readyRaf = 0;

let headerPad: number | null = null;
let pillRo: ResizeObserver | null = null;
let pillRaf = 0;
let pillObserved: Element | null = null;

let contentRo: ResizeObserver | null = null;
let contentRaf = 0;

/* ------------------------------ Measurements ------------------------------ */

const measurePill = () => {
	const el = innerEl.value;
	const header = headerEl.value;
	if (!el || !header) return;
	if (headerPad === null) {
		const cs = getComputedStyle(header);
		headerPad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
	}
	const px = headerPad;
	const w = el.scrollWidth + px + PILL_PADDING;
	if (w > PILL_PADDING) pillWidth.value = w;

	if (!pillRo) {
		pillRo = new ResizeObserver(() => {
			cancelAnimationFrame(pillRaf);
			pillRaf = requestAnimationFrame(() => {
				const inner = innerEl.value;
				const pad = headerPad ?? 0;
				if (!inner) return;
				const width = inner.scrollWidth + pad + PILL_PADDING;
				if (width > PILL_PADDING) pillWidth.value = width;
			});
		});
	}

	if (pillObserved !== el) {
		if (pillObserved) pillRo.unobserve(pillObserved);
		pillRo.observe(el);
		pillObserved = el;
	}
};

const measureContent = () => {
	if (contentRo) contentRo.disconnect();
	cancelAnimationFrame(contentRaf);
	if (!hasDesc.value) {
		contentHeight.value = 0;
		return;
	}
	const el = contentEl.value;
	if (!el) return;
	contentHeight.value = el.scrollHeight;
	if (!contentRo) {
		contentRo = new ResizeObserver(() => {
			cancelAnimationFrame(contentRaf);
			contentRaf = requestAnimationFrame(() => {
				const e = contentEl.value;
				if (e) contentHeight.value = e.scrollHeight;
			});
		});
	}
	contentRo.observe(el);
};

onMounted(() => {
	measurePill();
	measureContent();
	readyRaf = requestAnimationFrame(() => {
		ready.value = true;
	});
});

// Re-measure pill width whenever the header morphs (matches the React layout effect).
watch(() => headerLayer.value.current.key, measurePill, { flush: "post" });
// Re-measure content whenever the description/button presence toggles.
watch(hasDesc, measureContent, { flush: "post" });

/* --------------------------- Header morph layers -------------------------- */

watch([headerKey, view], ([key]) => {
	const state = headerLayer.value;
	if (state.current.key === key) {
		if (state.current.view === view.value) return;
		headerLayer.value = { ...state, current: { key, view: view.value } };
	} else {
		headerLayer.value = { prev: state.current, current: { key, view: view.value } };
	}
});

watch(
	() => headerLayer.value.prev,
	(prev) => {
		if (!prev) return;
		if (headerExitTimer !== null) clearTimeout(headerExitTimer);
		headerExitTimer = window.setTimeout(() => {
			headerExitTimer = null;
			headerLayer.value = { ...headerLayer.value, prev: null };
		}, HEADER_EXIT_MS);
	},
);

/* ----------------------------- Sync fill ---------------------------------- */

watch(
	() => props.fill,
	(fill) => {
		if (view.value.fill !== fill) view.value = { ...view.value, fill };
	},
);

/* ----------------------------- Refresh logic ------------------------------ */

watch(
	() => props.refreshKey,
	(refreshKey) => {
		if (refreshKey === undefined) {
			view.value = { ...next.value };
			applied.value = undefined;
			pending = null;
			lastRefreshKey = refreshKey;
			return;
		}

		if (lastRefreshKey === refreshKey) return;
		lastRefreshKey = refreshKey;

		if (swapTimer !== null) {
			clearTimeout(swapTimer);
			swapTimer = null;
		}

		if (open.value) {
			pending = { key: refreshKey, payload: { ...next.value } };
			isExpanded.value = false;
			swapTimer = window.setTimeout(() => {
				swapTimer = null;
				if (!pending) return;
				view.value = pending.payload;
				applied.value = pending.key;
				pending = null;
			}, SWAP_COLLAPSE_MS);
		} else {
			pending = null;
			view.value = { ...next.value };
			applied.value = refreshKey;
		}
	},
);

/* ----------------------------- Auto expand/collapse ----------------------- */

watch(
	[
		() => props.autoCollapseDelayMs,
		() => props.autoExpandDelayMs,
		hasDesc,
		allowExpand,
		() => props.exiting,
		applied,
	],
	() => {
		if (!hasDesc.value) return;

		if (autoExpandTimer !== null) clearTimeout(autoExpandTimer);
		if (autoCollapseTimer !== null) clearTimeout(autoCollapseTimer);

		if (props.exiting || !allowExpand.value) {
			isExpanded.value = false;
			return;
		}

		if (props.autoExpandDelayMs == null && props.autoCollapseDelayMs == null)
			return;

		const expandDelay = props.autoExpandDelayMs ?? 0;
		const collapseDelay = props.autoCollapseDelayMs ?? 0;

		if (expandDelay > 0) {
			autoExpandTimer = window.setTimeout(() => {
				isExpanded.value = true;
			}, expandDelay);
		} else {
			isExpanded.value = true;
		}

		if (collapseDelay > 0) {
			autoCollapseTimer = window.setTimeout(() => {
				isExpanded.value = false;
			}, collapseDelay);
		}
	},
	{ immediate: true },
);

/* ------------------------------ Derived values ---------------------------- */

const minExpanded = HEIGHT * MIN_EXPAND_RATIO;
const rawExpanded = computed(() =>
	hasDesc.value ? Math.max(minExpanded, HEIGHT + contentHeight.value) : minExpanded,
);

const frozenExpanded = ref(rawExpanded.value);
watchEffect(() => {
	if (open.value) frozenExpanded.value = rawExpanded.value;
});

const expanded = computed(() =>
	open.value ? rawExpanded.value : frozenExpanded.value,
);
const svgHeight = computed(() =>
	hasDesc.value ? Math.max(expanded.value, minExpanded) : HEIGHT,
);
const expandedContent = computed(() => Math.max(0, expanded.value - HEIGHT));
const resolvedPillWidth = computed(() => Math.max(pillWidth.value || HEIGHT, HEIGHT));
const pillHeight = computed(() => HEIGHT + blur.value * 3);

const pillX = computed(() =>
	props.position === "right"
		? WIDTH - resolvedPillWidth.value
		: props.position === "center"
			? (WIDTH - resolvedPillWidth.value) / 2
			: 0,
);

/* ---------------------------- Animate targets ----------------------------- */

const pillAnimate = computed(() => ({
	x: pillX.value,
	width: resolvedPillWidth.value,
	height: open.value ? pillHeight.value : HEIGHT,
}));

const bodyAnimate = computed(() => ({
	height: open.value ? expandedContent.value : 0,
	opacity: open.value ? 1 : 0,
}));

const bodyTransition = computed(() => (open.value ? SPRING : { ...SPRING, bounce: 0 }));
const pillTransition = computed(() => (ready.value ? SPRING : { duration: 0 }));

const viewBox = computed(() => `0 0 ${WIDTH} ${svgHeight.value}`);
const canvasStyle = computed(() => ({ filter: `url(#${filterId.value})` }));

const rootStyle = computed<Record<string, string>>(() => ({
	"--_h": `${open.value ? expanded.value : HEIGHT}px`,
	"--_pw": `${resolvedPillWidth.value}px`,
	"--_px": `${pillX.value}px`,
	"--_ht": `translateY(${open.value ? (props.expand === "bottom" ? 3 : -3) : 0}px) scale(${open.value ? 0.9 : 1})`,
	"--_co": `${open.value ? 1 : 0}`,
}));

/* -------------------------------- Handlers -------------------------------- */

const handleEnter = (e: MouseEvent) => {
	emit("hoverenter", e);
	if (hasDesc.value) isExpanded.value = true;
};

const handleLeave = (e: MouseEvent) => {
	emit("hoverleave", e);
	isExpanded.value = false;
};

const handleTransitionEnd = (e: TransitionEvent) => {
	if (e.propertyName !== "height" && e.propertyName !== "transform") return;
	if (open.value) return;
	if (!pending) return;
	if (swapTimer !== null) {
		clearTimeout(swapTimer);
		swapTimer = null;
	}
	view.value = pending.payload;
	applied.value = pending.key;
	pending = null;
};

const handleButtonClick = (e: MouseEvent) => {
	e.preventDefault();
	e.stopPropagation();
	view.value.button?.onClick();
};

/* -------------------------------- Swipe ----------------------------------- */

const SWIPE_DISMISS = 30;
const SWIPE_MAX = 20;
let pointerStart: number | null = null;

const onMove = (e: PointerEvent) => {
	const el = buttonEl.value;
	if (pointerStart === null || !el) return;
	const dy = e.clientY - pointerStart;
	const sign = dy > 0 ? 1 : -1;
	const clamped = Math.min(Math.abs(dy), SWIPE_MAX) * sign;
	el.style.transform = `translateY(${clamped}px)`;
};

const onUp = () => {
	const el = buttonEl.value;
	if (pointerStart === null || !el) return;
	const dy = pointerLastDy;
	pointerStart = null;
	el.style.transform = "";
	el.removeEventListener("pointermove", onMovePassive);
	el.removeEventListener("pointerup", onUp);
	if (Math.abs(dy) > SWIPE_DISMISS) emit("dismiss");
};

// Track the latest delta so `onUp` (no event needed) can read it.
let pointerLastDy = 0;
const onMovePassive = (e: PointerEvent) => {
	if (pointerStart !== null) pointerLastDy = e.clientY - pointerStart;
	onMove(e);
};

const handlePointerDown = (e: PointerEvent) => {
	if (props.exiting) return;
	const target = e.target as HTMLElement;
	if (target.closest("[data-sileo-button]")) return;
	pointerStart = e.clientY;
	pointerLastDy = 0;
	(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	const el = buttonEl.value;
	if (el) {
		el.addEventListener("pointermove", onMovePassive, { passive: true });
		el.addEventListener("pointerup", onUp, { passive: true });
	}
};

/* -------------------------------- Cleanup --------------------------------- */

onBeforeUnmount(() => {
	if (headerExitTimer !== null) clearTimeout(headerExitTimer);
	if (autoExpandTimer !== null) clearTimeout(autoExpandTimer);
	if (autoCollapseTimer !== null) clearTimeout(autoCollapseTimer);
	if (swapTimer !== null) clearTimeout(swapTimer);
	cancelAnimationFrame(readyRaf);
	cancelAnimationFrame(pillRaf);
	cancelAnimationFrame(contentRaf);
	pillRo?.disconnect();
	contentRo?.disconnect();
	const el = buttonEl.value;
	if (el) {
		el.removeEventListener("pointermove", onMovePassive);
		el.removeEventListener("pointerup", onUp);
	}
});
</script>

<template>
	<button
		ref="buttonEl"
		type="button"
		data-sileo-toast
		:data-ready="ready"
		:data-expanded="open"
		:data-exiting="exiting"
		:data-edge="expand"
		:data-position="position"
		:data-state="view.state"
		:style="rootStyle"
		@mouseenter="handleEnter"
		@mouseleave="handleLeave"
		@transitionend="handleTransitionEnd"
		@pointerdown="handlePointerDown"
	>
		<div data-sileo-canvas :data-edge="expand" :style="canvasStyle">
			<svg data-sileo-svg :width="WIDTH" :height="svgHeight" :viewBox="viewBox">
				<title>Sileo Notification</title>
				<GooeyDefs :filter-id="filterId" :blur="blur" />
				<motion.rect
					data-sileo-pill
					:rx="resolvedRoundness"
					:ry="resolvedRoundness"
					:fill="view.fill"
					:initial="false"
					:animate="pillAnimate"
					:transition="pillTransition"
				/>
				<motion.rect
					data-sileo-body
					:y="HEIGHT"
					:width="WIDTH"
					:rx="resolvedRoundness"
					:ry="resolvedRoundness"
					:fill="view.fill"
					:initial="false"
					:animate="bodyAnimate"
					:transition="bodyTransition"
				/>
			</svg>
		</div>

		<div ref="headerEl" data-sileo-header :data-edge="expand">
			<div data-sileo-header-stack>
				<div
					ref="innerEl"
					:key="headerLayer.current.key"
					data-sileo-header-inner
					data-layer="current"
				>
					<div
						data-sileo-badge
						:data-state="headerLayer.current.view.state"
						:class="headerLayer.current.view.styles?.badge"
					>
						<RenderNode
							:node="headerLayer.current.view.icon ?? STATE_ICON[headerLayer.current.view.state]"
						/>
					</div>
					<span
						data-sileo-title
						:data-state="headerLayer.current.view.state"
						:class="headerLayer.current.view.styles?.title"
					>
						{{ headerLayer.current.view.title }}
					</span>
				</div>
				<div
					v-if="headerLayer.prev"
					:key="headerLayer.prev.key"
					data-sileo-header-inner
					data-layer="prev"
					data-exiting="true"
				>
					<div
						data-sileo-badge
						:data-state="headerLayer.prev.view.state"
						:class="headerLayer.prev.view.styles?.badge"
					>
						<RenderNode
							:node="headerLayer.prev.view.icon ?? STATE_ICON[headerLayer.prev.view.state]"
						/>
					</div>
					<span
						data-sileo-title
						:data-state="headerLayer.prev.view.state"
						:class="headerLayer.prev.view.styles?.title"
					>
						{{ headerLayer.prev.view.title }}
					</span>
				</div>
			</div>
		</div>

		<div
			v-if="hasDesc"
			data-sileo-content
			:data-edge="expand"
			:data-visible="open"
		>
			<div
				ref="contentEl"
				data-sileo-description
				:class="view.styles?.description"
			>
				<RenderNode :node="view.description" />
				<a
					v-if="view.button"
					href="#"
					type="button"
					data-sileo-button
					:data-state="view.state"
					:class="view.styles?.button"
					@click="handleButtonClick"
				>
					{{ view.button.title }}
				</a>
			</div>
		</div>
	</button>
</template>
