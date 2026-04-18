// Mock data for Edusonex AaaS MVP
// Realistic seed data simulating multi-tenant agency state.

export type AgentType = "performance" | "creative" | "budget" | "audience" | "nurturing";
export type AgentStatus = "active" | "warning" | "idle";
export type LeadStatus = "new" | "contacted" | "qualified" | "converted";
export type CampaignStatus = "active" | "paused" | "draft";

export interface School {
  id: string;
  name: string;
  city: string;
  studentsTarget: number;
  monthlySpend: number;
  roas: number;
  cpa: number;
  leads: number;
  status: "healthy" | "attention" | "critical";
}

export interface Campaign {
  id: string;
  schoolId: string;
  name: string;
  platform: "meta";
  status: CampaignStatus;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  cpa: number;
  roas: number;
}

export interface Lead {
  id: string;
  schoolId: string;
  name: string;
  phone: string;
  intent: string;
  status: LeadStatus;
  createdAt: string;
}

export interface AgentLog {
  id: string;
  schoolId: string;
  agentType: AgentType;
  action: string;
  reasoning: string;
  metadata: Record<string, unknown>;
  severity: "info" | "warning" | "success" | "error";
  createdAt: string;
}

export const schools: School[] = [
  {
    id: "sch_001",
    name: "Greenwood International School",
    city: "Bangalore",
    studentsTarget: 240,
    monthlySpend: 184000,
    roas: 4.8,
    cpa: 612,
    leads: 301,
    status: "healthy",
  },
  {
    id: "sch_002",
    name: "Riverside Academy",
    city: "Mumbai",
    studentsTarget: 180,
    monthlySpend: 142000,
    roas: 3.2,
    cpa: 894,
    leads: 159,
    status: "attention",
  },
  {
    id: "sch_003",
    name: "Heritage Public School",
    city: "Delhi",
    studentsTarget: 320,
    monthlySpend: 226000,
    roas: 5.6,
    cpa: 524,
    leads: 432,
    status: "healthy",
  },
];

export const campaigns: Campaign[] = [
  {
    id: "cmp_001",
    schoolId: "sch_001",
    name: "Admissions 2025 — Grade 1 Intake",
    platform: "meta",
    status: "active",
    spend: 84200,
    impressions: 412000,
    clicks: 8240,
    ctr: 2.0,
    leads: 142,
    cpa: 593,
    roas: 5.1,
  },
  {
    id: "cmp_002",
    schoolId: "sch_001",
    name: "Open House Funnel — Bangalore",
    platform: "meta",
    status: "active",
    spend: 99800,
    impressions: 521000,
    clicks: 6132,
    ctr: 1.18,
    leads: 159,
    cpa: 627,
    roas: 4.6,
  },
  {
    id: "cmp_003",
    schoolId: "sch_002",
    name: "STEM Showcase — Lead Gen",
    platform: "meta",
    status: "paused",
    spend: 68000,
    impressions: 298000,
    clicks: 3540,
    ctr: 1.19,
    leads: 62,
    cpa: 1096,
    roas: 2.4,
  },
  {
    id: "cmp_004",
    schoolId: "sch_002",
    name: "Senior Secondary Awareness",
    platform: "meta",
    status: "active",
    spend: 74000,
    impressions: 312000,
    clicks: 4892,
    ctr: 1.57,
    leads: 97,
    cpa: 763,
    roas: 3.8,
  },
  {
    id: "cmp_005",
    schoolId: "sch_003",
    name: "Heritage Admissions Drive",
    platform: "meta",
    status: "active",
    spend: 126000,
    impressions: 684000,
    clicks: 14820,
    ctr: 2.17,
    leads: 286,
    cpa: 441,
    roas: 6.2,
  },
  {
    id: "cmp_006",
    schoolId: "sch_003",
    name: "Scholarship Test Promotion",
    platform: "meta",
    status: "active",
    spend: 100000,
    impressions: 489000,
    clicks: 9120,
    ctr: 1.86,
    leads: 146,
    cpa: 685,
    roas: 4.9,
  },
];

// Generate 20+ leads per school
const intents = [
  "Grade 1 admission",
  "Grade 6 transfer",
  "Boarding inquiry",
  "Scholarship interest",
  "Open house RSVP",
  "Fee structure",
  "Pre-K enrollment",
  "Senior secondary stream",
  "Sports program",
  "STEM curriculum",
];
const firstNames = ["Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Meera", "Karan", "Diya", "Arjun", "Ishita", "Nikhil", "Sara", "Aditya", "Riya", "Kabir", "Tara", "Dev", "Naina", "Yash", "Pooja", "Arnav", "Kiara"];
const lastNames = ["Sharma", "Patel", "Reddy", "Iyer", "Khan", "Singh", "Mehta", "Nair", "Gupta", "Das", "Kumar", "Rao", "Joshi", "Verma"];
const statuses: LeadStatus[] = ["new", "contacted", "qualified", "converted"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function genLeadsForSchool(schoolId: string, count: number, startIdx: number): Lead[] {
  const out: Lead[] = [];
  for (let i = 0; i < count; i++) {
    const fn = firstNames[(i + startIdx) % firstNames.length];
    const ln = lastNames[(i * 3 + startIdx) % lastNames.length];
    const daysAgo = (i * 7 + startIdx) % 45;
    const hoursAgo = (i * 13) % 24;
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(d.getHours() - hoursAgo);
    out.push({
      id: `lead_${schoolId}_${pad(i + 1)}`,
      schoolId,
      name: `${fn} ${ln}`,
      phone: `+91 9${(800000000 + i * 137 + startIdx * 991).toString().slice(0, 9)}`,
      intent: intents[(i + startIdx) % intents.length],
      status: statuses[(i + startIdx) % statuses.length],
      createdAt: d.toISOString(),
    });
  }
  return out;
}

export const leads: Lead[] = [
  ...genLeadsForSchool("sch_001", 24, 0),
  ...genLeadsForSchool("sch_002", 22, 7),
  ...genLeadsForSchool("sch_003", 28, 3),
];

// Agent logs - realistic reasoning chains
const logTemplates: Array<Omit<AgentLog, "id" | "schoolId" | "createdAt">> = [
  {
    agentType: "performance",
    action: "Paused underperforming ad set",
    reasoning:
      "CTR dropped by 18% in last 7 days → frequency exceeded 3.5 → CPA increased 42% above target → action: pause ad set 'Lookalike 2% — Parents 25-44'",
    metadata: { ad_set: "LAL_2pct_parents_25_44", ctr_change: -18, frequency: 3.7, cpa_delta: 42 },
    severity: "warning",
  },
  {
    agentType: "creative",
    action: "Rotated creative — fatigue detected",
    reasoning:
      "Creative 'campus_tour_v3' frequency reached 4.2 → CTR declined 24% week-over-week → swapped in 'student_testimonial_v1' which performed +31% in A/B test",
    metadata: { paused: "campus_tour_v3", activated: "student_testimonial_v1", ab_lift: 31 },
    severity: "success",
  },
  {
    agentType: "budget",
    action: "Reallocated ₹12,000 daily budget",
    reasoning:
      "Campaign 'Heritage Admissions Drive' ROAS = 6.2x, well above 4.0 target → shifted ₹12,000/day from 'STEM Showcase' (ROAS 2.4x) → projected lift +28 leads/week",
    metadata: { from: "cmp_003", to: "cmp_005", amount: 12000, projected_leads: 28 },
    severity: "success",
  },
  {
    agentType: "audience",
    action: "Expanded lookalike audience",
    reasoning:
      "Conversion rate on LAL 1% saturated at 0.8% → expanded to LAL 3% with interest layer 'Private Schools, Education' → reach +340K, expected CPA increase ≤8%",
    metadata: { from: "LAL_1pct", to: "LAL_3pct_interest", reach_delta: 340000 },
    severity: "info",
  },
  {
    agentType: "nurturing",
    action: "Sent 24h follow-up sequence",
    reasoning:
      "14 leads inactive for >24h after first contact → triggered nurture sequence 'admission_followup_v2' on WhatsApp → 9 read, 4 replied within 2h",
    metadata: { recipients: 14, read: 9, replied: 4, sequence: "admission_followup_v2" },
    severity: "info",
  },
  {
    agentType: "performance",
    action: "Flagged anomaly in spend pattern",
    reasoning:
      "Daily spend exceeded budget cap by 14% on Meta Ads account → likely auto-bidding spike during peak hours → throttled bid cap from ₹420 to ₹360",
    metadata: { spend_delta: 14, bid_old: 420, bid_new: 360 },
    severity: "error",
  },
  {
    agentType: "creative",
    action: "Generated 3 new ad variants",
    reasoning:
      "Top performer 'open_house_v2' identified — generated 3 variants with headline rotation focusing on 'scholarship', 'STEM lab', 'sports facilities' → queued for review",
    metadata: { base: "open_house_v2", variants: 3 },
    severity: "info",
  },
  {
    agentType: "budget",
    action: "Increased daily cap by 20%",
    reasoning:
      "Campaign hit daily budget by 2pm with CPA ₹441 (target ₹600) → opportunity cost detected → raised daily cap from ₹4,200 to ₹5,040",
    metadata: { old_cap: 4200, new_cap: 5040 },
    severity: "success",
  },
  {
    agentType: "audience",
    action: "Excluded converted leads",
    reasoning:
      "286 converted leads still in active audience → uploaded suppression list to all live ad sets → estimated wasted spend reduction ₹8,400/week",
    metadata: { suppressed: 286, savings_per_week: 8400 },
    severity: "success",
  },
  {
    agentType: "nurturing",
    action: "Qualified 6 leads via WhatsApp Q&A",
    reasoning:
      "6 leads completed 5-question intent qualifier → all expressed Grade 6+ admission interest with budget fit → marked 'qualified', notified counselor",
    metadata: { qualified: 6, notified: "counselor_team" },
    severity: "success",
  },
  {
    agentType: "performance",
    action: "Detected creative fatigue cluster",
    reasoning:
      "5 of 8 active creatives crossed frequency 3.0 → CTR cluster declining → recommended full creative refresh in 48h window",
    metadata: { fatigued: 5, total: 8 },
    severity: "warning",
  },
  {
    agentType: "budget",
    action: "Paused campaign — ROAS below floor",
    reasoning:
      "Campaign 'STEM Showcase' ROAS = 2.4x for 5 consecutive days, below 3.0x floor → paused → freed ₹68,000 monthly budget for reallocation",
    metadata: { campaign: "cmp_003", roas: 2.4, freed_budget: 68000 },
    severity: "error",
  },
  {
    agentType: "audience",
    action: "Built custom audience from website",
    reasoning:
      "1,820 page views on /admissions in last 14 days, only 12% retargeted → created custom audience 'admissions_pageview_14d' for retargeting campaign",
    metadata: { source: "/admissions", visitors: 1820, retargeted_pct: 12 },
    severity: "info",
  },
  {
    agentType: "nurturing",
    action: "Escalated 2 high-intent leads",
    reasoning:
      "2 leads asked about fee structure + visit dates within 5 minutes → high purchase intent signal → escalated to human counselor with conversation context",
    metadata: { escalated: 2, signals: ["fee_inquiry", "visit_request"] },
    severity: "success",
  },
  {
    agentType: "creative",
    action: "Disabled creative — policy risk",
    reasoning:
      "Creative 'guaranteed_admission_v1' flagged by policy scanner → 'guaranteed' language violates Meta Ads policy → disabled before review trigger",
    metadata: { creative: "guaranteed_admission_v1", risk: "policy_violation" },
    severity: "error",
  },
];

function genAgentLogs(): AgentLog[] {
  const out: AgentLog[] = [];
  let counter = 1;
  for (let i = 0; i < 60; i++) {
    const tpl = logTemplates[i % logTemplates.length];
    const school = schools[i % schools.length];
    const d = new Date();
    d.setMinutes(d.getMinutes() - i * 47 - (i % 13) * 11);
    out.push({
      id: `log_${pad(counter++)}`,
      schoolId: school.id,
      ...tpl,
      createdAt: d.toISOString(),
    });
  }
  return out;
}

export const agentLogs: AgentLog[] = genAgentLogs();

// Agent status widgets
export interface AgentStatusInfo {
  type: AgentType;
  name: string;
  description: string;
  status: AgentStatus;
  lastActionAt: string;
  actionsToday: number;
}

export const agentStatuses: AgentStatusInfo[] = [
  {
    type: "performance",
    name: "Performance Auditor",
    description: "Monitors CTR, CPA, frequency. Pauses underperformers.",
    status: "warning",
    lastActionAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    actionsToday: 12,
  },
  {
    type: "creative",
    name: "Creative Analyst",
    description: "Detects fatigue, rotates and generates variants.",
    status: "active",
    lastActionAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    actionsToday: 18,
  },
  {
    type: "budget",
    name: "Budget Manager",
    description: "Reallocates spend across campaigns by ROAS.",
    status: "active",
    lastActionAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    actionsToday: 7,
  },
  {
    type: "audience",
    name: "Audience Architect",
    description: "Builds and refines lookalike + custom audiences.",
    status: "idle",
    lastActionAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    actionsToday: 3,
  },
  {
    type: "nurturing",
    name: "Lead Nurturing Agent",
    description: "Runs WhatsApp follow-ups, qualifies and escalates.",
    status: "active",
    lastActionAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    actionsToday: 34,
  },
];

// Time series for dashboard charts (last 14 days)
export interface TimeSeriesPoint {
  date: string;
  spend: number;
  leads: number;
  roas: number;
}

export const performanceSeries: TimeSeriesPoint[] = Array.from({ length: 14 }).map((_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (13 - i));
  const base = 24000 + Math.sin(i / 2) * 4000 + i * 800;
  return {
    date: d.toISOString().slice(5, 10),
    spend: Math.round(base),
    leads: Math.round(40 + Math.cos(i / 1.7) * 12 + i * 1.4),
    roas: +(3.6 + Math.sin(i / 2.3) * 1.2 + i * 0.05).toFixed(2),
  };
});

// Aggregate KPIs
export const agencyKpis = {
  totalLeads: leads.length,
  totalSpend: campaigns.reduce((s, c) => s + c.spend, 0),
  avgRoas: +(campaigns.reduce((s, c) => s + c.roas, 0) / campaigns.length).toFixed(2),
  avgCpa: Math.round(campaigns.reduce((s, c) => s + c.cpa, 0) / campaigns.length),
  activeCampaigns: campaigns.filter((c) => c.status === "active").length,
  totalSchools: schools.length,
};
