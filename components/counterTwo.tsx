import Card from "./Card";
import useCounter from "../causes/counterCause";

export default function CounterTwo() {
  const { count } = useCounter();
  return (
    <Card description="This will show how scoped state works" title="Counter 2">
         <p class="text-gray-700 mt-4">The current count is {count}</p>
    </Card>
  );
}
