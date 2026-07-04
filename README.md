<div align="center">
  <h1>Sileo · Vue</h1>
  <p>An opinionated, physics-based toast component for Vue 3.</p>
  <p>A faithful port of <a href="https://github.com/hiaaryan/sileo">sileo</a> (React) to Vue 3 + Vite + TypeScript.</p>
</div>

### Getting Started

```vue
<script setup lang="ts">
import { sileo, Toaster } from "sileo-vue";
import "sileo-vue/styles.css";
</script>

<template>
  <Toaster position="top-right" />
  <button @click="sileo.success({ title: 'Saved' })">Toast</button>
</template>
```

### API

The imperative API mirrors the original 1:1:

```ts
sileo.success({ title, description, ... });
sileo.error(opts);
sileo.warning(opts);
sileo.info(opts);
sileo.action(opts);
sileo.show({ type: "loading", duration: null });

sileo.promise(promise, {
  loading: { title: "Uploading" },
  success: { title: "Done" },
  error: { title: "Failed" },
});

sileo.dismiss(id);
sileo.clear(); // or clear(position)
```

`description` and `icon` accept a string, a Vue `VNode`, or a render function
(`() => VNodeChild`) — the Vue equivalent of the original's `ReactNode`.

### Development

```bash
npm install
npm run dev         # playground at localhost:5173
npm run build       # builds the library into dist/
npm run type-check  # vue-tsc
```

### What changed in the port

| Concern            | React source                          | Vue port                                       |
| ------------------ | ------------------------------------- | ---------------------------------------------- |
| Animation          | `motion/react` (`motion.rect`)        | `motion-v` (`<motion.rect>`)                   |
| Global store       | manual listener `Set` + `useState`    | shared Vue `ref` (auto-reactive)               |
| Component state    | `useState` / `useRef` / `useEffect`   | `ref` / plain vars / `watch` / `watchEffect`   |
| Icons              | JSX components (`icons.tsx`)           | `h()` functional components (`icons.ts`)       |
| `styles.css`       | —                                     | copied **verbatim** (all `[data-sileo-*]`)     |

The rendered DOM (elements, nesting, and every `data-sileo-*` attribute) is
identical to the React version, so the stylesheet is reused unchanged.

### License

MIT
