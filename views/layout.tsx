export default function Layout({ children }: { children: HTMLElement | HTMLElement[] }) {
    return <div className="min-h-screen flex flex-col justify-center items-center">{children}</div>;
}
