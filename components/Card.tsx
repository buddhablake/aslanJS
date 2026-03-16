interface CardProps {
    title: string;
    description: string;
}

export default function Card({ title, description }: CardProps) {
    return (
        <div class="bg-white shadow-md rounded-lg p-6 w-full max-w-sm">
            <h2 class="text-xl font-semibold mb-2">{title}</h2>
            <p class="text-gray-700">{description}</p>
        </div>
    );
}