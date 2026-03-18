import Card from "./Card";
import {count} from "../causes/counterCause";

export default function CounterOne() {
  return (
    <Card description="This will show how global state works" title="Counter 1">
         <p className={count() < 0 ? "text-red-500" : count() === 0 ? "text-gray-700" : "text-green-500"}>The current count is {count()}</p>
    </Card>
  );
}