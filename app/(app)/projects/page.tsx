import { FolderKanban, Plus } from "lucide-react";
import { EmptyState } from "@/components/founder-os/empty-state";
import { ProjectOrganizer, type OrganizedProject } from "@/components/founder-os/project-organizer";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { requireProfile } from "@/lib/auth";
import type { BusinessType, ProjectStatus } from "@/lib/founder-os/types";
import type { ProjectLifecycleStatus } from "@/lib/database.types";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { summarizeProof } from "@/lib/proof-board";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Saved projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const [profile, params, supabase] = await Promise.all([requireProfile(), searchParams, createClient()]);
  await logBetaEvent({ userId: profile.id, eventName: "project_library_viewed", source: "projects", throttleSeconds: 15 * 60 });
  const [{ data: projects, error }, { data: proofRows }, { data: focus }, { data: reflections }] = await Promise.all([
    supabase
      .from("opportunity_projects")
      .select("id,title,business_type,target_customer,score,status,lifecycle_status,lifecycle_version,last_meaningful_activity_at,deleted_at,recovery_expires_at,created_at,updated_at")
      .eq("user_id", profile.id)
      .order("last_meaningful_activity_at", { ascending: false })
      .limit(100),
    supabase
      .from("project_validation_experiments")
      .select("project_id,people_contacted,replies,pain_confirmed,interested_users,waitlist_signups,payment_intent,preorders_or_revenue_cents")
      .eq("user_id", profile.id)
      .limit(1000),
    supabase.from("founder_project_focus").select("project_id").eq("user_id", profile.id).maybeSingle(),
    supabase.from("project_closure_reflections").select("project_id").eq("user_id", profile.id),
  ]);

  const rows = projects ?? [];
  const organizedProjects: OrganizedProject[] = rows.map((project) => {
    const proof = summarizeProof((proofRows ?? []).filter((row) => row.project_id === project.id));
    return {
      id: project.id,
      title: project.title?.trim() || "Untitled project",
      businessType: project.business_type as BusinessType,
      targetCustomer: project.target_customer,
      score: project.score,
      status: project.status as ProjectStatus,
      lifecycleStatus: project.lifecycle_status as ProjectLifecycleStatus,
      lifecycleVersion: project.lifecycle_version,
      isCurrentFocus: focus?.project_id === project.id,
      deletedAt: project.deleted_at,
      recoveryExpiresAt: project.recovery_expires_at,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      lastMeaningfulActivityAt: project.last_meaningful_activity_at ?? project.updated_at,
      proofConfidence: proof.confidence_score,
      proofExperiments: proof.experiment_count,
      peopleContacted: proof.people_contacted,
      nextAction: nextActionForProject(project.status as ProjectStatus, proof),
      hasClosureReflection: (reflections ?? []).some((reflection) => reflection.project_id === project.id),
    };
  });

  return (
    <div>
      <FormMessage message={params.message} type="success" />
      <FormMessage message={params.error ?? (error ? "Could not load projects yet. If this is your first time using PrismForge, run the latest Supabase migration." : undefined)} />

      <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-violet">
            <FolderKanban className="size-4" />
            Saved projects
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your project library.</h1>
          <p className="mt-3 max-w-2xl text-ink/60">
            Keep one clear current focus while preserving paused, completed, archived, and stopped project history.
          </p>
        </div>
        <ButtonLink href="/generate" className="gap-2"><Plus className="size-4" />Create another project</ButtonLink>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No projects yet" description="Create your first project workspace with a target customer, MVP, validation plan, and next action." href="/generate" action="Create your first project" />
          <p className="mt-4 rounded-2xl bg-cream/70 p-4 text-sm font-semibold text-ink/60">Not seeing a project you created? Make sure you signed in with the same email.</p>
        </div>
      ) : (
        <ProjectOrganizer projects={organizedProjects} referenceNow={new Date().toISOString()} />
      )}
    </div>
  );
}

function nextActionForProject(status: ProjectStatus, proof: ReturnType<typeof summarizeProof>) {
  if (proof.experiment_count === 0) return "Create your first Proof Board experiment.";
  if (proof.people_contacted < 5) return "Contact 5 target users and log what happened.";
  if (proof.replies < 3) return "Improve outreach and get your first 3 replies.";
  if (proof.pain_confirmed < 3) return "Confirm the pain with 3 people.";
  if (proof.interested_users < 1 && proof.waitlist_signups < 1) return "Ask interested users to join a waitlist or beta.";
  if (proof.payment_intent < 1 && proof.preorders_or_revenue_cents <= 0) return "Test payment intent before overbuilding.";
  if (status === "idea") return "Move this project into validation.";
  if (status === "validating") return "Use proof to choose the smallest MVP.";
  if (status === "building") return "Finish one MVP flow and invite testers.";
  return "Review feedback and improve retention.";
}
