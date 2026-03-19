import { createCause, createScopedCause } from "@/src/aslan";

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export type Filter = 'all' | 'active' | 'completed';

let nextId = 1;

const useTodos = createScopedCause(() => {
  const [todos, setTodos] = createCause<Todo[]>([]);
  const [filter, setFilter] = createCause<Filter>('all');
  const [editingId, setEditingId] = createCause<number | null>(null);

  const filtered = () => {
    const f = filter();
    const all = todos();
    if (f === 'active') return all.filter(t => !t.completed);
    if (f === 'completed') return all.filter(t => t.completed);
    return all;
  };

  const remaining = () => todos().filter(t => !t.completed).length;
  const completedCount = () => todos().filter(t => t.completed).length;

  const add = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTodos(prev => [...prev, { id: nextId++, text: trimmed, completed: false }]);
  };

  const toggle = (id: number) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const toggleAll = () => {
    const allDone = remaining() === 0;
    setTodos(prev => prev.map(t => ({ ...t, completed: !allDone })));
  };

  const remove = (id: number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const edit = (id: number, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      remove(id);
    } else {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, text: trimmed } : t));
    }
    setEditingId(null);
  };

  const clearCompleted = () => {
    setTodos(prev => prev.filter(t => !t.completed));
  };

  return {
    todos, filter, setFilter,
    editingId, setEditingId,
    filtered, remaining, completedCount,
    add, toggle, toggleAll, remove, edit, clearCompleted,
  };
});

export default useTodos;
