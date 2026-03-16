import { Link } from "@/src/aslan-router";
import { createSignal, onCleanup } from "@/src/aslan";
import Card from "@/components/Card";

export default function Home() {
  const [seconds, setSeconds] = createSignal(0);

  const interval = setInterval(() => {
    setSeconds(s => s + 1);
    console.log("[Home] tick", seconds());
  }, 1000);

  console.log("[Home] started interval", interval);

  onCleanup(() => {
    console.log("[Home] cleaning up! clearing interval", interval);
    clearInterval(interval);
  });

  return (
    <>
      <Card title="Welcome to AslanJS" description="A simple and powerful JavaScript framework for building web applications." />
      <p class="mt-2 text-gray-600">Seconds on this page: {seconds}</p>
      <div class="mt-4">
        <Link href="/about"><button class="bg-blue-500 text-white px-4 py-2 rounded">Learn more about AslanJS</button></Link>
      </div>
    </>
  );
}
