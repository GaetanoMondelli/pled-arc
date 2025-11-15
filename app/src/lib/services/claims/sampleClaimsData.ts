/**
 * Sample Claims Data
 *
 * Provides sample data to populate the claims system for testing and demonstration.
 */

import { claimsService } from "./claimsService";
import { Claim, ClaimFormulaType, ClaimStatus } from "../../core/types/claims";

// Sample claims data based on real-world compliance scenarios
export const sampleClaimsData = [
  {
    title: "Enhanced Sink State Monitor Demo",
    description: "Demo claim with working template and execution for testing Enhanced Sink State Monitor with real external events and ledger execution output",
    owner: "demo@company.com",
    formulaType: "AND" as ClaimFormulaType,
    sinks: ["RegistrySink", "result_sink_0"], // Actual sink nodes from the template
    templateId: "5FWDJYeR0jbDl7PzI1bzr", // Working Captive Solar credit template
    executionId: "Fxbyuyx35f2oHxkQV8fsv", // Working execution with 4 external events
    resources: [
      "https://docs.template.com/captive-solar-credit",
      "/templates/carbon-credit-methodology.pdf"
    ],
    references: [
      "https://unfccc.int/process-and-meetings/the-paris-agreement",
      "https://en.wikipedia.org/wiki/Carbon_credit"
    ],
    tags: ["demo", "carbon-credit", "external-events", "sink-monitor"],
    status: "in_progress" as ClaimStatus,
  },
  {
    title: "Building Permit Compliance",
    description: "Overall compliance for building permit including foundation, electrical, and safety inspections",
    owner: "project.manager@construction.com",
    formulaType: "AND" as ClaimFormulaType,
    sinks: ["foundation.inspection.sink", "electrical.approval.sink", "safety.review.sink"],
    resources: [
      "https://docs.company.com/building-permit-requirements",
      "/templates/building-compliance-checklist.pdf"
    ],
    references: [
      "https://gov.uk/building-regulations",
      "https://en.wikipedia.org/wiki/Building_code"
    ],
    tags: ["compliance", "building", "safety"],
    status: "in_progress" as ClaimStatus,
  },
  {
    title: "Foundation Safety Inspection",
    description: "Foundation concrete quality and structural integrity verification",
    owner: "foundation.inspector@company.com",
    formulaType: "THRESHOLD" as ClaimFormulaType,
    sinks: ["soil.test.sink", "concrete.test.sink", "structural.analysis.sink"],
    threshold: 2,
    resources: ["/docs/foundation-standards.pdf"],
    references: ["https://standards.iso.org/foundation-testing"],
    tags: ["foundation", "safety", "structural"],
    status: "passed" as ClaimStatus,
    parentClaimId: "1", // Child of Building Permit Compliance
  },
  {
    title: "Carbon Emissions Q4 2024",
    description: "Quarterly carbon emissions reporting and CBAM compliance for steel operations",
    owner: "sustainability@steel.company.com",
    formulaType: "CUSTOM" as ClaimFormulaType,
    sinks: ["emission.monitor.sink", "energy.usage.sink", "production.volume.sink"],
    expression: "(emission_total / production_volume) < 2.1 && energy_renewable_percentage > 0.3",
    resources: [
      "/reports/carbon-methodology.pdf",
      "/templates/cbam-calculation-template.xlsx"
    ],
    references: [
      "https://ec.europa.eu/taxation_customs/carbon-border-adjustment_en",
      "https://unfccc.int/process-and-meetings/the-paris-agreement"
    ],
    tags: ["carbon", "emissions", "cbam", "sustainability"],
    status: "pending" as ClaimStatus,
  },
  {
    title: "Monthly Quality Checks",
    description: "Monthly quality assurance checks across all production lines",
    owner: "qa.lead@manufacturing.com",
    formulaType: "MAJORITY" as ClaimFormulaType,
    sinks: [
      "line1.quality.sink", "line2.quality.sink", "line3.quality.sink",
      "line4.quality.sink", "line5.quality.sink"
    ],
    resources: ["/quality/monthly-checklist.pdf"],
    references: ["https://www.iso.org/iso-9001-quality-management.html"],
    tags: ["quality", "manufacturing", "monthly"],
    status: "failed" as ClaimStatus,
  },
  {
    title: "Financial Audit Trail Q4",
    description: "Comprehensive financial audit trail for Q4 2024 including all transactions and approvals",
    owner: "audit@finance.company.com",
    formulaType: "AND" as ClaimFormulaType,
    sinks: [
      "transaction.approval.sink", "management.signoff.sink",
      "external.audit.sink", "regulatory.filing.sink"
    ],
    resources: [
      "/audit/procedures-manual.pdf",
      "/templates/audit-trail-template.xlsx"
    ],
    references: [
      "https://www.sec.gov/about/laws/soa2002.pdf",
      "https://www.ifrs.org/issued-standards/"
    ],
    tags: ["finance", "audit", "compliance", "quarterly"],
    status: "under_review" as ClaimStatus,
  },
  {
    title: "Data Privacy Compliance GDPR",
    description: "GDPR compliance verification for user data processing and storage",
    owner: "privacy@company.com",
    formulaType: "AND" as ClaimFormulaType,
    sinks: [
      "consent.management.sink", "data.encryption.sink",
      "access.control.sink", "breach.response.sink"
    ],
    resources: [
      "/privacy/gdpr-compliance-guide.pdf",
      "/templates/privacy-impact-assessment.docx"
    ],
    references: [
      "https://gdpr.eu/",
      "https://ico.org.uk/for-organisations/guide-to-data-protection/"
    ],
    tags: ["privacy", "gdpr", "data-protection", "security"],
    status: "passed" as ClaimStatus,
  },
  {
    title: "Supply Chain Verification",
    description: "End-to-end supply chain verification for ethical sourcing and sustainability",
    owner: "supply.chain@company.com",
    formulaType: "WEIGHTED" as ClaimFormulaType,
    sinks: [
      "supplier.certification.sink", "origin.tracking.sink",
      "ethical.audit.sink", "environmental.impact.sink"
    ],
    resources: [
      "/supply-chain/verification-standards.pdf",
      "/docs/ethical-sourcing-policy.pdf"
    ],
    references: [
      "https://www.unglobalcompact.org/",
      "https://www.iso.org/iso-26000-social-responsibility.html"
    ],
    tags: ["supply-chain", "ethics", "sustainability", "verification"],
    status: "expired" as ClaimStatus,
  },
  {
    title: "Cybersecurity Incident Response",
    description: "Verification of cybersecurity incident response procedures and effectiveness",
    owner: "security@company.com",
    formulaType: "THRESHOLD" as ClaimFormulaType,
    sinks: [
      "detection.system.sink", "response.team.sink",
      "containment.procedure.sink", "recovery.process.sink", "lessons.learned.sink"
    ],
    threshold: 4,
    resources: [
      "/security/incident-response-plan.pdf",
      "/templates/incident-report-template.docx"
    ],
    references: [
      "https://www.nist.gov/cyberframework",
      "https://www.iso.org/isoiec-27001-information-security.html"
    ],
    tags: ["security", "incident-response", "cybersecurity"],
    status: "suspended" as ClaimStatus,
  }
];

// Function to populate sample data
export async function populateSampleClaims(): Promise<void> {
  console.log("Populating sample claims data...");

  try {
    // Set a mock user for the service
    claimsService.setCurrentUser("system-admin@company.com");

    for (const claimData of sampleClaimsData) {
      await claimsService.createClaim(claimData);
    }

    console.log(`Successfully created ${sampleClaimsData.length} sample claims`);
  } catch (error) {
    console.error("Error populating sample claims:", error);
  }
}

// Function to clear all claims (useful for testing)
export async function clearAllClaims(): Promise<void> {
  console.log("Clearing all claims...");

  try {
    const allClaims = await claimsService.getAllClaims();

    for (const claim of allClaims) {
      await claimsService.deleteClaim(claim.id);
    }

    console.log(`Successfully deleted ${allClaims.length} claims`);
  } catch (error) {
    console.error("Error clearing claims:", error);
  }
}

// Function to reset claims data (clear + populate)
export async function resetClaimsData(): Promise<void> {
  await clearAllClaims();
  await populateSampleClaims();
}