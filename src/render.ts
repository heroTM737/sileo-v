import type { FunctionalComponent, VNodeChild } from "vue";
import type { SileoNode } from "./types";

/**
 * Renders a `SileoNode` (string, number, VNode, or render function) into the
 * tree — the Vue equivalent of interpolating a React `ReactNode` in JSX.
 */
export const RenderNode: FunctionalComponent<{
	node?: SileoNode | null;
}> = (props): VNodeChild => {
	const node = props.node;
	if (node == null) return null;
	if (typeof node === "function") return node();
	return node;
};
