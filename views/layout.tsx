import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";

export default function Layout({ children }: { children: HTMLElement | HTMLElement[] }) {

    return (
        <>
            <Header />
            <Container>
                {children}
            </Container>
            <Footer />
        </>
    );
}
