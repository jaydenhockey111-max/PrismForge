import type { OpportunityCategory } from "@/lib/database.types";

export const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"], ["DC", "District of Columbia"],
] as const;

export const INCOME_RANGES = [
  ["under_25k", "Under $25,000"], ["25k_50k", "$25,000-$50,000"],
  ["50k_100k", "$50,000-$100,000"], ["100k_200k", "$100,000-$200,000"],
  ["over_200k", "Over $200,000"],
] as const;

export const STUDENT_STATUSES = [
  ["not_student", "Not a student"], ["high_school", "High school"],
  ["undergraduate", "Undergraduate"], ["graduate", "Graduate student"],
  ["vocational", "Vocational / trade school"],
] as const;

export const INTERESTS = ["Arts", "Business", "Community Service", "Design", "Education", "Engineering", "Environment", "Finance", "Health", "Research", "Science", "Technology"];

export const CATEGORIES: { value: OpportunityCategory; label: string }[] = [
  { value: "startup_grant", label: "Startup grant" },
  { value: "pitch_competition", label: "Pitch competition" },
  { value: "accelerator", label: "Accelerator" },
  { value: "hackathon", label: "Hackathon" },
  { value: "founder_fellowship", label: "Founder fellowship" },
  { value: "small_business_rebate", label: "Small business rebate" },
];

export const categoryLabel = (category: OpportunityCategory) =>
  CATEGORIES.find((item) => item.value === category)?.label ?? category;
