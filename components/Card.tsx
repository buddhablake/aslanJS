interface CardProps {
    title: string;
    description: string;
    children?: Node | Node[];
}

export default function Card({ title, description, children }: CardProps) {
    return (
        <div class="bg-white shadow-md rounded-lg p-6 w-full max-w-sm">
            <h2 class="text-xl font-semibold mb-2">{title}</h2>
            <p class="text-gray-700">{description}</p>
            {children}
        </div>
    );
}