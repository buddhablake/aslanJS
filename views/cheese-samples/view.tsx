import { Link } from '@/src/aslan-router';
import useCounter from "@/causes/counterCause";



export default function CheeseSamplesContent() {
    const { count } = useCounter();

  return (
    <>
      <h1>Cheese Samples</h1>
      <p class="text-gray-700 mt-4">The current count is {count}</p>
      <Link href="/">
        <button>Go Home</button>
      </Link>
    </>
  );
}


