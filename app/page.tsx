import Header from "@/components/Header";
import Hero from "@/components/Hero";
import LiveMonitor from "@/components/LiveMonitor";
import DatasetSection from "@/components/DatasetSection";
import EdaSection from "@/components/EdaSection";
import ModelsSection from "@/components/ModelsSection";
import MethodSection from "@/components/MethodSection";
import Footer from "@/components/Footer";

const Rule = () => <div className="max-w-[1120px] mx-auto px-5 md:px-8"><div className="hair" /></div>;

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Rule />
        <LiveMonitor />
        <Rule />
        <DatasetSection />
        <Rule />
        <EdaSection />
        <Rule />
        <ModelsSection />
        <Rule />
        <MethodSection />
      </main>
      <Footer />
    </>
  );
}
