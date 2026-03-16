import { Link } from "@/aslan-router";

export default function Home() {
  return (
    <>
      <h1>Home</h1>
      <Link href="/about">
        <button>Go to About</button>
      </Link>
    </>
  );
}
