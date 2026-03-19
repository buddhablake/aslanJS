import { Provide } from "@/src/aslan";
import useTodos from "@/causes/todoCause";

export default function Layout(props: { children: Node | Node[] }) {
  return (
    <Provide contexts={[useTodos]}>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-16 px-4">
        {props.children}
      </div>
    </Provide>
  );
}
