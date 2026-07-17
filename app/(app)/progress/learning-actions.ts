"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuid=z.string().uuid();
const feedbackType=z.enum(["useful","dismiss","correct","exclude_project","incomplete_data","circumstances_changed"]);

export async function submitFounderPatternFeedback(input:{insightId:string;feedbackType:string;reason?:string;excludedProjectId?:string|null;requestId:string}){
  const profile=await requireProfile();const insight=uuid.safeParse(input.insightId),type=feedbackType.safeParse(input.feedbackType),request=uuid.safeParse(input.requestId),excluded=input.excludedProjectId?uuid.safeParse(input.excludedProjectId):null;
  if(!insight.success||!type.success||!request.success||(excluded&&!excluded.success))return{ok:false as const,error:"That feedback request was invalid."};
  const reason=String(input.reason??"").trim().replace(/[\u0000-\u001f\u007f]/g," ").slice(0,1200);
  const supabase=await createClient();const {error}=await supabase.rpc("record_founder_pattern_feedback",{p_insight_id:insight.data,p_feedback_type:type.data,p_reason:reason,p_excluded_project_id:excluded?.success?excluded.data:null,p_request_id:request.data});
  if(error)return{ok:false as const,error:/does not exist|schema cache/i.test(error.message)?"Cross-project learning is awaiting the Tier 3B migration.":error.message.length<180?error.message:"Feedback could not be saved."};
  const eventName=type.data==="dismiss"?"founder_pattern_dismissed":type.data==="useful"?"founder_pattern_feedback_useful":"founder_pattern_corrected";
  await logBetaEvent({userId:profile.id,eventName,source:"cross_project_learning",metadata:{feedback_type:type.data,has_reason:Boolean(reason),excluded_project:Boolean(excluded?.success)}});
  revalidatePath("/progress");revalidatePath("/timeline");
  return{ok:true as const};
}

export async function setProjectLearningInclusion(input:{projectId:string;include:boolean;reason?:string;markSynthetic?:boolean;requestId:string}){
  const profile=await requireProfile();const project=uuid.safeParse(input.projectId),request=uuid.safeParse(input.requestId);if(!project.success||!request.success)return{ok:false as const,error:"That project request was invalid."};
  const reason=String(input.reason??"").trim().replace(/[\u0000-\u001f\u007f]/g," ").slice(0,500);const supabase=await createClient();
  const {error}=await supabase.rpc("set_project_learning_inclusion",{p_project_id:project.data,p_include:Boolean(input.include),p_reason:reason,p_mark_synthetic:Boolean(input.markSynthetic),p_request_id:request.data});
  if(error)return{ok:false as const,error:/does not exist|schema cache/i.test(error.message)?"Project learning controls are awaiting the Tier 3B migration.":error.message.length<180?error.message:"Project learning preference could not be saved."};
  await logBetaEvent({userId:profile.id,projectId:project.data,eventName:input.include?"founder_pattern_corrected":"project_creation_history_reminder_dismissed",source:"project_learning_control",metadata:{included:Boolean(input.include),synthetic:Boolean(input.markSynthetic)}});
  revalidatePath(`/projects/${project.data}`);revalidatePath("/progress");return{ok:true as const};
}
