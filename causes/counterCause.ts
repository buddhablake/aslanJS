import {createSignal} from "../src/aslan";

export const [count, setCount] = createSignal(0);

export function increment() {
    setCount(count() + 1);
}

export function decrement() {
    setCount(count() - 1);
}

export function reset() {
    setCount(0);
}