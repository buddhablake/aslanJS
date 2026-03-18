export default function Container({ children }: { children: Node | Node[] }) {
    return (
        <div class="container mx-auto p-4">
            {children}
        </div>
    );
}