import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import { Provide } from "@/src/aslan";
import useCounter from "@/causes/counterCause";


export default function Layout(props: { children: Node | Node[] }) {

    return (
        <>
        <Provide contexts={[useCounter]}>
            <Header />
            <Container>
                {props.children}
            </Container>
            <Footer />
        </Provide>
        </>
    );
}
