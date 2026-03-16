export default function Container({ children }: { children: HTMLElement | HTMLElement[] }) {
    return (
        <div class="container mx-auto p-4">
            {children}
        </div>
    );
}