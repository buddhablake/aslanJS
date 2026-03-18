import Card from "./Card";
import useCounter from "../causes/counterCause";

export default function CounterOne() {
  const { count } = useCounter();
  return (
    <Card description="This will show how scoped state works" title="Counter 1">
         <p className={() => count() < 0 ? "text-red-500" : count() === 0 ? "text-gray-700" : "text-green-500"}>The current count is {count}</p>
    </Card>
  );
}
