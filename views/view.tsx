import { Link } from "@/src/aslan-router";
import Card from "@/components/Card";
import { increment, decrement, reset } from "@/causes/counterCause";
import CounterOne from "@/components/counterOne";
import CounterTwo from "@/components/counterTwo";

export default function Home() {

  return (
    <>
      <Card title="Welcome to AslanJS" description="A simple and powerful JavaScript framework for building web applications." />
      <div class="mt-4 flex gap-8">
        <CounterOne />
        <CounterTwo />
      </div>
      <div class="mt-4">
        <button onClick={increment} class="bg-green-500 text-white px-4 py-2 rounded mr-2">Increment</button>
        <button onClick={decrement} class="bg-red-500 text-white px-4 py-2 rounded mr-2">Decrement</button>
        <button onClick={reset} class="bg-gray-500 text-white px-4 py-2 rounded">Reset</button>
      </div>
      <div class="mt-6">
        <Link href="/about"><button class="bg-blue-500 text-white px-4 py-2 rounded">Learn more about AslanJS</button></Link>
      </div>
    </>
  );
}
