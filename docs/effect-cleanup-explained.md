# Effect Cleanup: How It Works

## The Problem: Ghost Workers

Imagine you run a restaurant. Every time a customer sits at a table, you hire a waiter to serve them. The waiter watches the kitchen and brings out new dishes whenever they're ready.

Now imagine the customer leaves... but **you never fire the waiter**. He's still standing at the empty table. Still watching the kitchen. Still trying to bring food to a chair nobody is sitting in. Hire enough ghost waiters and your restaurant grinds to a halt.

That was our bug. In Aslan, **effects** are the waiters. **Signals** are the kitchen. When you navigated to a new page, the old page's effects kept running — watching signals, updating DOM nodes that had already been thrown away.

---

## What's a Signal?

A signal is a box that holds a value and **knows who's watching it**.

```ts
const [count, setCount] = createCause(0);
```

- `count()` — open the box and peek at the value
- `setCount(5)` — put a new value in the box, then **tap every watcher on the shoulder** so they know something changed

Think of it like a group chat. When you read a message (`count()`), you're subscribing to the chat. When someone sends a new message (`setCount(5)`), everyone in the chat gets a notification.

---

## What's an Effect?

An effect is a function that **reacts** to signals. It runs once immediately, and then re-runs every time a signal it read changes.

```ts
createEffect(() => {
  console.log("The count is", count());
});
```

The first time this runs, it calls `count()`. That's like joining the group chat — the signal now knows this effect is watching. Later, when `setCount(5)` is called, the signal notifies the effect and it runs again.

---

## The Old Code (Before)

Here's roughly what `createEffect` used to look like:

```ts
let currentEffect = null;

function createEffect(fn) {
  currentEffect = fn;    // "hey signals, the next person to read you is THIS effect"
  fn();                  // run the function (which reads signals, subscribing automatically)
  currentEffect = null;  // done subscribing
}
```

Simple, but broken:

- **No way to unsubscribe.** Once a signal knows about an effect, it's permanent. Even if the page that created the effect is gone.
- **No way to clean up side effects.** If your effect started a timer or opened a websocket, there was no hook to stop it.
- **No parent-child relationship.** Effects didn't know about each other. The Router couldn't say "destroy everything from the old page."

---

## The New Code (After)

### Big Idea 1: Effects Are Now Objects, Not Just Functions

Before, an effect was just a bare function. Now it's a rich object called an `EffectContext`:

```ts
interface EffectContext {
  fn: () => void;              // the original function you wrote
  cleanups: (() => void)[];    // teardown callbacks (like clearing timers)
  subscriptions: Set[];        // which signal subscriber-lists we're in
  childDisposables: (() => void)[]; // kill-switches for child effects
  execute: () => void;         // the "run this effect" method
}
```

Think of it like upgrading from a Post-it note ("serve table 5") to an employee file with an ID badge, a list of responsibilities, and a termination procedure.

### Big Idea 2: Bidirectional Tracking

**Before:** When you read a signal, the signal remembered you. One-way.

**After:** Both sides remember each other.

```ts
// When an effect reads a signal:
subscribers.add(currentEffect);           // signal remembers the effect
currentEffect.subscriptions.push(subscribers); // effect remembers the signal
```

Why? Because when it's time to clean up, the effect needs to **walk up to every signal and say "take me off your list."** If the effect didn't remember which signals it subscribed to, it couldn't unsubscribe.

It's like keeping a list of every group chat you've joined, so you can leave them all at once when you quit.

### Big Idea 3: Cleanup Before Re-run

Every time an effect re-runs, it does a full reset first:

```
execute() {
  1. Run all cleanup callbacks    → "stop any timers I started last time"
  2. Dispose all child effects    → "fire all the waiters I hired last time"
  3. Unsubscribe from all signals → "leave every group chat"
  4. Run the function fresh       → "now do it all again from scratch"
}
```

This means every re-run starts with a clean slate. No leftover subscriptions, no orphaned children, no zombie timers.

### Big Idea 4: The Owner Tree (Parent-Child Effects)

This is the most magical part. When an effect runs, any effects created *during* its execution become its **children**.

How? Two global variables:

```ts
let currentEffect = null;      // "who is currently running?"
let currentDisposables = null;  // "where should new effects register their kill-switch?"
```

When an effect runs:
1. It sets `currentDisposables` to its own `childDisposables` list
2. Any `createEffect()` calls inside will push their dispose function onto that list
3. When the parent re-runs, it calls all those dispose functions first

**The Restaurant Metaphor:**

Think of the Router as the restaurant **manager**. When a customer (URL) changes:

1. The manager fires every waiter from the old table (disposes child effects)
2. Each fired waiter cancels their kitchen orders (cleanup callbacks) and removes themselves from the watch list (unsubscribes from signals)
3. The manager sets up fresh staff for the new table (runs the new page's component)

The beautiful part: **the Router code didn't change at all.** It already had a `createEffect` that re-runs on navigation. Now that `createEffect` has cleanup built in, the Router automatically cleans up the old page's entire component tree — every reactive text node, every timer, every effect — just by re-running.

### Big Idea 5: `onCleanup` — Your Personal Exit Hook

```ts
function MyPage() {
  const interval = setInterval(() => console.log("tick"), 1000);
  onCleanup(() => clearInterval(interval));
  return <div>Hello</div>;
}
```

`onCleanup` is dead simple — it just pushes a function onto `currentEffect.cleanups`:

```ts
function onCleanup(fn) {
  if (currentEffect) {
    currentEffect.cleanups.push(fn);
  }
}
```

When does this cleanup run? Two situations:
- **The effect re-runs** (signal changed) — cleanups run before the new run
- **The effect is disposed** (parent re-ran or was disposed) — cleanups run as part of teardown

It's like leaving a note on your desk: *"When I leave, turn off the coffee machine."* You don't have to worry about *when* you leave — the system handles it.

---

## How It All Fits Together

Here's a concrete walkthrough. You're on the Home page:

```
Router effect runs
  └── Home component executes
       ├── createCause(0) → creates [count, setCount]
       ├── setInterval → starts a timer
       ├── onCleanup → registers "clearInterval" on the Router's effect
       └── <div>{count}</div> → createEffect for reactive text
            └── this text effect is a CHILD of the Router effect
```

Now you click a link to the About page. `setCurrentPath("/about")` fires.

```
Router effect re-runs:
  1. Runs cleanups → clearInterval (our timer stops!)
  2. Disposes children → the text node effect is killed
     - Text effect unsubscribes from count signal
     - count signal's subscriber set is now empty
  3. Unsubscribes Router from old signals (none new here)
  4. Runs fresh → renders About component
```

The old page is fully gone. No ghost waiters. No phantom timers. No zombie subscriptions.

---

## Summary

| Concept | Metaphor | What It Does |
|---|---|---|
| Signal | Group chat | Holds a value, notifies watchers on change |
| Effect | Waiter | Runs a function reactively, re-runs when signals change |
| EffectContext | Employee file | Tracks everything about an effect so it can be fully cleaned up |
| Bidirectional tracking | Keeping a list of your group chats | Effects know which signals they watch, so they can unsubscribe |
| Owner tree | Manager → waiters hierarchy | Parent effects automatically clean up children on re-run |
| onCleanup | "When I leave, turn off the coffee machine" | Register teardown logic that runs on re-run or disposal |
| dispose | Firing a waiter | Runs cleanups, kills children, unsubscribes from everything |
