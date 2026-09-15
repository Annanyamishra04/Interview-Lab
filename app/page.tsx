import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { StudioSection } from "@/components/marketing/studio-section";
import { ResumeSection } from "@/components/marketing/resume-section";
import { FeedbackSection } from "@/components/marketing/feedback-section";
import { ClosingCta, MarketingFooter } from "@/components/marketing/footer";

export default function LandingPage() {
  return (
    <main>
      <MarketingNav />
      <Hero />
      <HowItWorks />
      <StudioSection />
      <ResumeSection />
      <FeedbackSection />
      <ClosingCta />
      <MarketingFooter />
    </main>
  );
}
