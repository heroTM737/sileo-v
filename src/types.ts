import type { VNode, VNodeChild } from "vue";

/**
 * Anything Sileo can render for a title/description/icon slot.
 * This is the Vue equivalent of React's `ReactNode`: a primitive, a VNode,
 * or a render function that returns one.
 */
export type SileoNode = string | number | VNode | (() => VNodeChild);

export type SileoState =
	| "success"
	| "loading"
	| "error"
	| "warning"
	| "info"
	| "action";

export interface SileoStyles {
	title?: string;
	description?: string;
	badge?: string;
	button?: string;
}

export interface SileoButton {
	title: string;
	onClick: () => void;
}

export const SILEO_POSITIONS = [
	"top-left",
	"top-center",
	"top-right",
	"bottom-left",
	"bottom-center",
	"bottom-right",
] as const;

export type SileoPosition = (typeof SILEO_POSITIONS)[number];

export interface SileoOptions {
	title?: string;
	description?: SileoNode | string;
	type?: SileoState;
	position?: SileoPosition;
	duration?: number | null;
	icon?: SileoNode | null;
	styles?: SileoStyles;
	fill?: string;
	roundness?: number;
	autopilot?: boolean | { expand?: number; collapse?: number };
	button?: SileoButton;
}
