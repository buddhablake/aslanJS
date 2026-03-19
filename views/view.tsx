import { createCause, Show, For } from "@/src/aslan";
import useTodos from "@/causes/todoCause";
import type { Todo, Filter } from "@/causes/todoCause";

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

function TodoInput() {
  const { add } = useTodos();
  const [text, setText] = createCause('');

  const submit = (e: Event) => {
    e.preventDefault();
    add(text());
    setText('');
  };

  return (
    <form onSubmit={submit} className="flex gap-3 w-full">
      <input
        type="text"
        placeholder="What needs to be done?"
        value={text()}
        onInput={(e: Event) => setText((e.target as HTMLInputElement).value)}
        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
      />
      <button
        type="submit"
        className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 shadow-sm transition-colors"
      >Add</button>
    </form>
  );
}

function TodoItem(props: { todo: Todo }) {
  const { toggle, remove, edit, editingId, setEditingId } = useTodos();
  const [editText, setEditText] = createCause(props.todo.text);

  const startEdit = () => {
    setEditText(props.todo.text);
    setEditingId(props.todo.id);
  };

  const commitEdit = () => edit(props.todo.id, editText());

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditingId(null);
  };

  return (
    <Show when={() => editingId() === props.todo.id} fallback={
      <div className="group flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <button
          onClick={() => toggle(props.todo.id)}
          className={
            props.todo.completed
              ? 'w-5 h-5 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center shrink-0'
              : 'w-5 h-5 rounded-full border-2 border-gray-300 hover:border-blue-400 shrink-0 transition-colors'
          }
        >
          <Show when={props.todo.completed}>
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </Show>
        </button>
        <span
          className={
            props.todo.completed
              ? 'flex-1 text-gray-400 line-through'
              : 'flex-1 text-gray-800'
          }
          onClick={startEdit}
        >{props.todo.text}</span>
        <button
          onClick={() => remove(props.todo.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-lg leading-none"
        >&times;</button>
      </div>
    }>
      <div className="px-4 py-2 bg-white rounded-xl border-2 border-blue-500 shadow-sm">
        <input
          type="text"
          value={editText()}
          onInput={(e: Event) => setEditText((e.target as HTMLInputElement).value)}
          onBlur={commitEdit}
          onKeyDown={onKeyDown}
          className="w-full py-1 text-gray-800 focus:outline-none"
        />
      </div>
    </Show>
  );
}

export default function Home() {
  const todos = useTodos();

  return (
    <div className="w-full max-w-lg">
      <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">todos</h1>

      <TodoInput />

      <Show when={() => todos.todos().length > 0}>
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4 px-1">
            <button
              onClick={todos.toggleAll}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >{() => todos.remaining() === 0 ? 'Uncheck all' : 'Check all'}</button>
            <div className="flex gap-1">
              <For each={() => FILTERS}>
                {(f: { key: Filter; label: string }) => (
                  <button
                    className={
                      todos.filter() === f.key
                        ? 'px-3 py-1 text-xs font-medium rounded-lg bg-blue-100 text-blue-700'
                        : 'px-3 py-1 text-xs font-medium rounded-lg text-gray-400 hover:text-gray-600'
                    }
                    onClick={() => todos.setFilter(f.key)}
                  >{f.label}</button>
                )}
              </For>
            </div>
          </div>

          <div className="space-y-2">
            <For each={todos.filtered}>
              {(todo: Todo) => <TodoItem todo={todo} />}
            </For>
          </div>

          <Show when={() => todos.filtered().length === 0}>
            <p className="text-center text-gray-400 text-sm py-8">{() => `No ${todos.filter()} todos`}</p>
          </Show>

          <div className="flex items-center justify-between mt-4 px-1 text-xs text-gray-400">
            <span>{() => `${todos.remaining()} ${todos.remaining() === 1 ? 'item' : 'items'} left`}</span>
            <Show when={() => todos.completedCount() > 0}>
              <button onClick={todos.clearCompleted} className="hover:text-gray-600 transition-colors">Clear completed</button>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
