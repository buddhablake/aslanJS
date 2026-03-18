import Card from "./Card";
import {count} from "../causes/counterCause";

export default function CounterTwo() {
  return (
    <Card description="This will show how global state works" title="Counter 2">
         <p class="text-gray-700 mt-4">The current count is {count()}</p>
    </Card>
  );
}