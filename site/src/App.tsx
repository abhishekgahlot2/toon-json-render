import Hero from "./components/Hero";
import DemoSection from "./components/DemoSection";
import Benchmarks from "./components/Benchmarks";
import HowItWorks from "./components/HowItWorks";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      <DemoSection />
      <Benchmarks />
      <HowItWorks />
      <Footer />
    </div>
  );
}
