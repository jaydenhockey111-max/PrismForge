import type { OpportunityCategory } from "@/lib/database.types";

export type DiscoveryQueryPack = {
  category: OpportunityCategory;
  source: string;
  query: string;
};

// Founder-focused hidden advantage layer. These searches intentionally bias toward
// official/trusted funding, launch, accelerator, hackathon, and rebate sources.
export const DISCOVERY_QUERY_PACKS: DiscoveryQueryPack[] = [
  {
    category: "startup_grant",
    source: "SBA startup grants",
    query: 'site:sba.gov startup grant small business entrepreneur eligibility application deadline 2026 2027',
  },
  {
    category: "startup_grant",
    source: "State startup grants",
    query: 'site:.gov startup grant entrepreneur small business innovation application deadline 2026 2027',
  },
  {
    category: "startup_grant",
    source: "Challenge.gov funding prizes",
    query: 'site:challenge.gov grant prize startup entrepreneur innovation submission deadline 2026 2027',
  },
  {
    category: "pitch_competition",
    source: "University pitch competitions",
    query: 'site:.edu startup pitch competition entrepreneur prize application deadline 2026 2027',
  },
  {
    category: "pitch_competition",
    source: "Government innovation challenges",
    query: 'site:.gov pitch competition startup challenge prize entrepreneurs deadline 2026 2027',
  },
  {
    category: "pitch_competition",
    source: "Founder prize competitions",
    query: '"startup pitch competition" "application deadline" "prize" 2026 2027 founder entrepreneur',
  },
  {
    category: "accelerator",
    source: "University accelerators",
    query: 'site:.edu startup accelerator founders application deadline cohort 2026 2027',
  },
  {
    category: "accelerator",
    source: "Government accelerators",
    query: 'site:.gov startup accelerator entrepreneur innovation cohort application deadline 2026 2027',
  },
  {
    category: "accelerator",
    source: "Trusted accelerators",
    query: '"startup accelerator" "applications open" "deadline" "cohort" 2026 2027',
  },
  {
    category: "hackathon",
    source: "University hackathons",
    query: 'site:.edu hackathon startup innovation entrepreneurship prize deadline 2026 2027',
  },
  {
    category: "hackathon",
    source: "Official hackathons",
    query: 'site:.gov hackathon challenge innovation prize submission deadline 2026 2027',
  },
  {
    category: "hackathon",
    source: "Builder hackathons",
    query: '"hackathon" "startup" "prize" "deadline" "apply" 2026 2027',
  },
  {
    category: "founder_fellowship",
    source: "Founder fellowships",
    query: '"founder fellowship" entrepreneur startup application deadline 2026 2027',
  },
  {
    category: "founder_fellowship",
    source: "University founder fellowships",
    query: 'site:.edu founder fellowship entrepreneur startup application deadline 2026 2027',
  },
  {
    category: "founder_fellowship",
    source: "Student founder programs",
    query: 'site:.edu student founder program entrepreneurship fellowship application deadline 2026 2027',
  },
  {
    category: "small_business_rebate",
    source: "State business rebates",
    query: 'site:.gov small business rebate incentive tax credit entrepreneur eligibility apply 2026 2027',
  },
  {
    category: "small_business_rebate",
    source: "Energy/business rebates",
    query: 'site:energy.gov small business rebate tax credit energy efficiency eligibility apply 2026',
  },
  {
    category: "small_business_rebate",
    source: "Local business incentives",
    query: 'site:.gov local small business incentive rebate grant entrepreneur application 2026 2027',
  },
];

export const DISCOVERY_QUERIES = DISCOVERY_QUERY_PACKS.map((pack) => pack.query);
