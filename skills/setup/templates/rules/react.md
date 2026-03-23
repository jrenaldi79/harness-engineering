---
globs: ["src/**/*.tsx", "src/**/*.jsx"]
---
# React: No Direct useEffect

Never call `useEffect` directly. It is the #1 source of React bugs — race conditions, infinite re-render loops, stale closures, and unnecessary re-renders. Use these five rules to pick the right replacement.

## Rule 1: Derive State Inline

If you're syncing state from props or other state via `useEffect` + `setState`, delete the effect and compute the value directly during render.

```tsx
// BAD — extra render, stale frame
const [filtered, setFiltered] = useState(products);
useEffect(() => { setFiltered(products.filter(p => p.active)); }, [products]);

// GOOD — derived inline, always fresh
const filtered = products.filter(p => p.active);
```

## Rule 2: Use Data-Fetching Libraries

Replace fetch-in-effect with React Query, SWR, or your framework's loader. These handle race conditions, caching, retries, and staleness automatically.

```tsx
// BAD — no cancellation, no cache, no retry
useEffect(() => { fetch(url).then(r => r.json()).then(setData); }, [url]);

// GOOD
const { data } = useQuery({ queryKey: ['items', id], queryFn: () => fetchItems(id) });
```

## Rule 3: Use Event Handlers

If the work is triggered by a user action, call it from the event handler — not from an effect watching a state flag.

```tsx
// BAD — indirect chain
const [shouldSubmit, setShouldSubmit] = useState(false);
useEffect(() => { if (shouldSubmit) postData(form); }, [shouldSubmit]);

// GOOD — direct
function handleClick() { postData(form); }
```

## Rule 4: useMountEffect for External Sync

When you genuinely need to sync with something outside React exactly once (focus an input, initialize a third-party widget, subscribe to a browser API), wrap `useEffect` with an empty deps array in a `useMountEffect` helper to make the intent explicit.

```tsx
function useMountEffect(fn: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fn, []);
}

useMountEffect(() => inputRef.current?.focus());
```

## Rule 5: Reset with Key Props

To reset component state when an ID changes, use the `key` prop instead of an effect that watches the ID and calls setState.

```tsx
// BAD
useEffect(() => { setComment(''); }, [postId]);

// GOOD — React unmounts and remounts, all state resets
<CommentForm key={postId} />
```

## Component Structure Convention

Organize components in this order: hooks, local state, computed values, event handlers, early returns, render. Computed values must never come from a `useEffect` + `setState` pair.
