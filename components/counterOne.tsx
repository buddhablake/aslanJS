import Card from "./Card";
import useCounter from "../causes/counterCause";
import { Show, For } from "@/src/aslan";

export default function CounterOne() {
  const { count } = useCounter();
  return (
    <Card description="This will show how scoped state works" title="Counter 1">
         <p className={() => count() < 0 ? "text-red-500" : count() === 0 ? "text-gray-700" : "text-green-500"}>The current count is {count}</p>
         <Show when={() => count() < 0}>
            <p class="text-red-500 mt-2">Count is negative!</p>
         </Show>
         <Show when={() => count() > 0}>
            <p class="text-green-500 mt-2">Count is positive!</p>
         </Show>
         <For each={() => [-1, 0, 1]}>
            {(num: number) => (
                <p>{num}</p>
            )}
         </For>
    </Card>
  );
}
