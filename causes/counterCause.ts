import { createCause, createScopedCause } from "../src/aslan";

const useCounter = createScopedCause(() => {
    const [count, setCount] = createCause(0);

    return {
        count,
        setCount,
        increment: () => setCount(c => c + 1),
        decrement: () => setCount(c => c - 1),
        reset: () => setCount(0),
    };
});

export default useCounter;
