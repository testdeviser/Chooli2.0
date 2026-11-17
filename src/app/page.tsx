import { IntroSequence } from '@/components/sections/IntroSequence';
import { NextSection } from '@/components/sections/NextSection';
import { CaseStudies } from '@/components/sections/CaseStudies';
import { HowWeWork } from '@/components/sections/HowWeWork';
import { MountainWordmark } from '@/components/sections/MountainWordmark';
import { Community } from '@/components/sections/Community';
import { FloatingHeader } from '@/components/ui/FloatingHeader';
import { SmoothScroll } from '@/components/ui/SmoothScroll';

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <FloatingHeader />
      <main>
        <IntroSequence />
        <NextSection />
        <CaseStudies />
        <HowWeWork />
        <MountainWordmark />
        <Community />
      </main>
    </>
  );
}
