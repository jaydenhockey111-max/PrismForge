import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Json } from "@/lib/database.types";
import { logBetaEvent } from "@/lib/analytics/betaEvents";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildFounderLearningSnapshot } from "./engine";
import { LEARNING_POLICY } from "./policy";
import type { FounderPatternCandidate, LearningProjectRecord, PatternSource } from "./types";

const INSIGHT_PAGE_SIZE = 12;
export const LEARNING_CATEGORIES = ["all","validation","stage","blocker","assumption","decision","constraint","project_type","outcome","lesson"] as const;

export type LearningInsightView = {
  id:string; insightKey:string; category:string; headline:string; explanation:string; evidenceTier:string; supportingProjectCount:number;
  contradictingProjectCount:number; limitations:string[]; dimensions:Record<string,Json|undefined>; generatedAt:string; dataThrough:string;
  sources:Array<{ projectId:string; projectTitle:string; role:"supporting"|"contradicting"; sourceKind:string; sourceId:string }>;
};
export type FounderLearningOverview = { eligibleProjectCount:number; completedProjectCount:number; pausedProjectCount:number; stoppedProjectCount:number; launchedProjectCount:number; revenueProjectCount:number; insights:LearningInsightView[]; totalInsights:number; page:number; totalPages:number; query:string; category:string; dataThrough:string|null; limitations:string[]; migrationPending:boolean; recalculationFailed:boolean };

export async function getFounderLearningOverview(userId:string,input:{query?:string;category?:string;page?:string|number}={}):Promise<FounderLearningOverview>{
  const query=clean(input.query,120),category=LEARNING_CATEGORIES.includes(input.category as never)?String(input.category):"all",page=Math.max(1,Math.min(1000,Number(input.page)||1));
  try { await recalculateIfDirty(userId); } catch(error) { await logBetaEvent({userId,eventName:"founder_learning_recalculation_failed",source:"cross_project_learning",metadata:{error_category:classifyError(error)}}); }
  const admin=createAdminClient() as any;
  const client=await createClient() as any;
  const [{data:snapshots,error:snapshotError},{data:state}] = await Promise.all([
    admin.from("founder_project_learning_snapshots").select("project_id,eligibility_status,lifecycle_outcome,stage_reached,revenue_evidence_count,limitations").eq("user_id",userId).limit(LEARNING_POLICY.maxProjectsPerFounder),
    admin.from("founder_learning_state").select("calculated_at,data_through,last_error_category").eq("user_id",userId).maybeSingle(),
  ]);
  if(snapshotError&&/does not exist|schema cache/i.test(snapshotError.message??""))return emptyOverview(query,category,page,true,false);
  const start=(page-1)*INSIGHT_PAGE_SIZE;
  const {data:insights,error}=await client.rpc("search_founder_patterns",{p_category:category==="all"?null:category,p_query:query||null,p_offset:start,p_limit:INSIGHT_PAGE_SIZE});
  const count=Number(insights?.[0]?.total_count??0);
  if(error&&/does not exist|schema cache/i.test(error.message??""))return emptyOverview(query,category,page,true,false);
  const insightIds=(insights??[]).map((item:any)=>item.id);
  const {data:sources}=insightIds.length?await admin.from("founder_pattern_insight_sources").select("insight_id,project_id,source_role,source_kind,source_id").eq("user_id",userId).in("insight_id",insightIds):{data:[]};
  const projectIds=Array.from(new Set((sources??[]).map((item:any)=>item.project_id)));
  const {data:projects}=projectIds.length?await admin.from("opportunity_projects").select("id,title").eq("user_id",userId).in("id",projectIds):{data:[]};
  const titles=new Map((projects??[]).map((item:any)=>[item.id,item.title]));
  const rows=snapshots??[],eligible=rows.filter((item:any)=>item.eligibility_status!=="ineligible");
  const views:LearningInsightView[]=(insights??[]).map((item:any)=>({id:item.id,insightKey:item.insight_key,category:item.category,headline:item.headline,explanation:item.explanation,evidenceTier:item.evidence_tier,supportingProjectCount:item.supporting_project_count,contradictingProjectCount:item.contradicting_project_count,limitations:Array.isArray(item.limitations)?item.limitations:[],dimensions:isRecord(item.dimensions)?item.dimensions:{},generatedAt:item.generated_at,dataThrough:item.data_through,sources:(sources??[]).filter((source:any)=>source.insight_id===item.id).map((source:any)=>({projectId:source.project_id,projectTitle:String(titles.get(source.project_id)??"Project"),role:source.source_role,sourceKind:source.source_kind,sourceId:source.source_id}))}));
  const limitations=unique<string>(rows.flatMap((item:any)=>Array.isArray(item.limitations)?item.limitations.filter((value:unknown):value is string=>typeof value==="string"):[])).slice(0,4);
  return { eligibleProjectCount:eligible.length,completedProjectCount:rows.filter((item:any)=>item.lifecycle_outcome==="completed").length,pausedProjectCount:rows.filter((item:any)=>item.lifecycle_outcome==="paused").length,stoppedProjectCount:rows.filter((item:any)=>item.lifecycle_outcome==="abandoned").length,launchedProjectCount:rows.filter((item:any)=>item.stage_reached==="launched").length,revenueProjectCount:rows.filter((item:any)=>Number(item.revenue_evidence_count)>0).length,insights:views,totalInsights:count??views.length,page,totalPages:Math.max(1,Math.ceil((count??views.length)/INSIGHT_PAGE_SIZE)),query,category,dataThrough:state?.data_through??null,limitations,migrationPending:false,recalculationFailed:Boolean(state?.last_error_category)};
}

export async function getRelevantFounderReminders(userId:string,input:{projectId:string;projectType:string;hoursPerWeek?:number|null}){
  const admin=createAdminClient() as any;
  const {data,error}=await admin.from("founder_pattern_insights").select("id,headline,explanation,evidence_tier,dimensions,supporting_project_count,contradicting_project_count").eq("user_id",userId).eq("status","active").order("supporting_project_count",{ascending:false}).limit(30);
  if(error)return[];
  const rows=(data??[]).filter((item:any)=>{const dimensions=isRecord(item.dimensions)?item.dimensions:{};return dimensions.project_type===input.projectType || (dimensions.hours_band==="five_or_less"&&(input.hoursPerWeek??99)<=5) || Boolean(dimensions.validation_method);});
  if(!rows.length)return[];
  const ids=rows.map((item:any)=>item.id);const {data:sources}=await admin.from("founder_pattern_insight_sources").select("insight_id,project_id").eq("user_id",userId).in("insight_id",ids);
  return rows.filter((item:any)=>(sources??[]).some((source:any)=>source.insight_id===item.id&&source.project_id!==input.projectId)).slice(0,2).map((item:any)=>({id:item.id,headline:item.headline,explanation:item.explanation,evidenceTier:item.evidence_tier,supportingProjectCount:item.supporting_project_count,contradictingProjectCount:item.contradicting_project_count}));
}

async function recalculateIfDirty(userId:string){
  const admin=createAdminClient() as any;
  const {data:state,error}=await admin.from("founder_learning_state").select("dirty_at,calculated_at,calculation_started_at").eq("user_id",userId).maybeSingle();
  if(error)throw error;
  if(!state){await admin.from("founder_learning_state").insert({user_id:userId,dirty_at:new Date().toISOString()});}
  const current=state??{dirty_at:new Date(0).toISOString(),calculated_at:null,calculation_started_at:null};
  if(current.calculated_at&&new Date(current.calculated_at)>=new Date(current.dirty_at))return;
  if(current.calculation_started_at&&Date.now()-new Date(current.calculation_started_at).getTime()<120000)return;
  const requestId=randomUUID(),startedAt=new Date().toISOString();
  let claim=admin.from("founder_learning_state").update({calculation_started_at:startedAt,calculation_request_id:requestId,last_error_category:null,updated_at:startedAt}).eq("user_id",userId).eq("dirty_at",current.dirty_at);
  if(current.calculation_started_at)claim=claim.eq("calculation_started_at",current.calculation_started_at);else claim=claim.is("calculation_started_at",null);
  const {data:claimed}=await claim.select("user_id").maybeSingle();if(!claimed)return;
  try{
    const records=await loadLearningRecords(userId);const snapshot=buildFounderLearningSnapshot(records);
    await persistCalculation(userId,requestId,snapshot.projectSummaries,snapshot.insights,snapshot.dataThrough);
  }catch(error){await admin.from("founder_learning_state").update({calculation_started_at:null,calculation_request_id:null,last_error_category:classifyError(error),updated_at:new Date().toISOString()}).eq("user_id",userId).eq("calculation_request_id",requestId);throw error;}
}

async function loadLearningRecords(userId:string):Promise<LearningProjectRecord[]>{
  const admin=createAdminClient() as any;const limit=LEARNING_POLICY.maxSourceRowsPerType;
  const [projectsResult,contextsResult,experimentsResult,decisionsResult,assumptionsResult,pathsResult,pathEventsResult,stageEventsResult,lifecycleResult,reflectionsResult]=await Promise.all([
    pagedRows((from,to)=>admin.from("opportunity_projects").select("id,title,business_type,status,lifecycle_status,created_at,updated_at,deleted_at,learning_excluded_at,is_synthetic").eq("user_id",userId).order("created_at",{ascending:true}).range(from,to),LEARNING_POLICY.maxProjectsPerFounder),
    pagedRows((from,to)=>admin.from("founder_project_learning_snapshots").select("project_id,hours_per_week,budget_band,technical_ability,risk_tolerance").eq("user_id",userId).range(from,to),LEARNING_POLICY.maxProjectsPerFounder),
    pagedRows((from,to)=>admin.from("project_validation_experiments").select("id,project_id,evidence_type,status,people_contacted,replies,pain_confirmed,interested_users,waitlist_signups,payment_intent,preorders_or_revenue_cents,created_at,updated_at,validation_path_id").eq("user_id",userId).range(from,to),limit),
    pagedRows((from,to)=>admin.from("project_decisions").select("id,project_id,decision_type,created_at,experiment_id").eq("user_id",userId).range(from,to),limit),
    pagedRows((from,to)=>admin.from("project_assumptions").select("id,project_id,assumption_key,status,updated_at").eq("user_id",userId).range(from,to),limit),
    pagedRows((from,to)=>admin.from("validation_paths").select("id,path_type").eq("user_id",userId).range(from,to),limit),
    pagedRows((from,to)=>admin.from("validation_path_events").select("id,project_id,event_type,next_path_type,created_at").eq("user_id",userId).range(from,to),limit),
    pagedRows((from,to)=>admin.from("project_stage_history").select("id,project_id,previous_stage,new_stage,created_at").eq("user_id",userId).range(from,to),limit),
    pagedRows((from,to)=>admin.from("project_lifecycle_events").select("id,project_id,event_type,created_at").eq("user_id",userId).not("project_id","is",null).range(from,to),limit),
    pagedRows((from,to)=>admin.from("project_closure_reflections").select("id,project_id,what_was_learned,biggest_mistake,closure_reason,would_do_differently,created_at").eq("user_id",userId).range(from,to),limit),
  ]);
  for(const result of [projectsResult,contextsResult,experimentsResult,decisionsResult,assumptionsResult,pathsResult,pathEventsResult,stageEventsResult,lifecycleResult,reflectionsResult])if(result.error)throw result.error;
  const contexts=new Map((contextsResult.data??[]).map((item:any)=>[item.project_id,item]));
  const pathById=new Map<string,string>((pathsResult.data??[]).map((item:any)=>[item.id,item.path_type])); // Compact structured path data only; raw AI output is never loaded.
  return (projectsResult.data??[]).map((project:any)=>{const context:any=contexts.get(project.id)??{};return{id:project.id,title:project.title,projectType:project.business_type,status:project.status,lifecycleStatus:project.lifecycle_status,createdAt:project.created_at,updatedAt:project.updated_at,deletedAt:project.deleted_at,excludedAt:project.learning_excluded_at,synthetic:Boolean(project.is_synthetic),constraints:{hoursPerWeek:numberOrNull(context.hours_per_week),budgetBand:context.budget_band??null,technicalAbility:context.technical_ability??null,riskTolerance:numberOrNull(context.risk_tolerance)},experiments:(experimentsResult.data??[]).filter((item:any)=>item.project_id===project.id).map((item:any)=>({id:item.id,evidenceType:item.evidence_type,status:item.status,peopleContacted:Number(item.people_contacted??0),replies:Number(item.replies??0),painConfirmed:Number(item.pain_confirmed??0),interestedUsers:Number(item.interested_users??0),waitlistSignups:Number(item.waitlist_signups??0),paymentIntent:Number(item.payment_intent??0),revenueCents:Number(item.preorders_or_revenue_cents??0),createdAt:item.created_at,updatedAt:item.updated_at,validationPathType:item.validation_path_id?pathById.get(item.validation_path_id)??null:null})),decisions:(decisionsResult.data??[]).filter((item:any)=>item.project_id===project.id).map((item:any)=>({id:item.id,decisionType:item.decision_type,createdAt:item.created_at,experimentId:item.experiment_id})),assumptions:(assumptionsResult.data??[]).filter((item:any)=>item.project_id===project.id).map((item:any)=>({id:item.id,key:item.assumption_key,status:item.status,updatedAt:item.updated_at})),pathEvents:(pathEventsResult.data??[]).filter((item:any)=>item.project_id===project.id).map((item:any)=>({id:item.id,eventType:item.event_type,nextPathType:item.next_path_type,createdAt:item.created_at})),stageEvents:(stageEventsResult.data??[]).filter((item:any)=>item.project_id===project.id).map((item:any)=>({id:item.id,previousStage:item.previous_stage,newStage:item.new_stage,createdAt:item.created_at})),lifecycleEvents:(lifecycleResult.data??[]).filter((item:any)=>item.project_id===project.id).map((item:any)=>({id:item.id,eventType:item.event_type,createdAt:item.created_at})),reflection:(reflectionsResult.data??[]).filter((item:any)=>item.project_id===project.id).map((item:any)=>({id:item.id,whatWasLearned:item.what_was_learned,biggestMistake:item.biggest_mistake,closureReason:item.closure_reason,wouldDoDifferently:item.would_do_differently,createdAt:item.created_at}))[0]??null};});
}

async function persistCalculation(userId:string,requestId:string,summaries:ReturnType<typeof buildFounderLearningSnapshot>["projectSummaries"],rawCandidates:FounderPatternCandidate[],dataThrough:string){
  const admin=createAdminClient() as any;
  const {data:existing,error}=await admin.from("founder_pattern_insights").select("id,insight_key,evidence_fingerprint,status").eq("user_id",userId);if(error)throw error;
  const existingById=new Map((existing??[]).map((item:any)=>[item.id,item]));
  const {data:feedback}=await admin.from("founder_pattern_feedback").select("insight_id,feedback_type,excluded_project_id").eq("user_id",userId).eq("feedback_type","exclude_project");
  const exclusions=new Map<string,Set<string>>();for(const row of feedback??[]){const insight:any=existingById.get(row.insight_id);if(!insight||!row.excluded_project_id)continue;const set=exclusions.get(insight.insight_key)??new Set<string>();set.add(row.excluded_project_id);exclusions.set(insight.insight_key,set);}
  const candidates=rawCandidates.map((candidate)=>applyExclusions(candidate,exclusions.get(candidate.insightKey))).filter((candidate)=>candidate.supportingProjectIds.length>0);
  const snapshotRows=summaries.map((item)=>({project_id:item.projectId,user_id:userId,eligibility_status:item.eligibility,eligibility_reason:item.eligibilityReason,project_type:item.projectType,lifecycle_outcome:item.lifecycleOutcome,stage_reached:item.stageReached,hours_per_week:item.founderConstraints.hoursPerWeek??null,budget_band:item.founderConstraints.budgetBand??null,risk_tolerance:item.founderConstraints.riskTolerance??null,technical_ability:item.founderConstraints.technicalAbility??null,validation_methods:item.validationMethods,evidence_types:item.evidenceTypes,meaningful_decision_count:item.meaningfulDecisionCount,experiment_count:item.experimentCount,customer_conversation_count:item.customerConversationCount,waitlist_signal_count:item.waitlistSignalCount,payment_intent_count:item.paymentIntentCount,revenue_evidence_count:item.revenueEvidenceCount,time_to_first_evidence_days:item.timeToFirstEvidenceDays??null,time_in_stages:item.timeInStages,blocker_categories:item.blockerCategories,assumption_summary:item.assumptionSummary,decision_types:item.decisionTypes,closure_reflection_ids:item.closureReflectionIds,limitations:item.limitations,source_updated_at:item.sourceUpdatedAt,calculated_at:new Date().toISOString()}));
  if(snapshotRows.length){const {error:snapshotError}=await admin.from("founder_project_learning_snapshots").upsert(snapshotRows,{onConflict:"project_id"});if(snapshotError)throw snapshotError;}
  const fingerprints:string[]=[];let identifiedCount=0,updatedCount=0;
  for(const candidate of candidates){fingerprints.push(candidate.evidenceFingerprint);const same=(existing??[]).find((item:any)=>item.insight_key===candidate.insightKey&&item.evidence_fingerprint===candidate.evidenceFingerprint);if(same){if(same.status==="pending")await admin.from("founder_pattern_insights").update({calculation_request_id:requestId}).eq("id",same.id).eq("user_id",userId);continue;}if((existing??[]).some((item:any)=>item.insight_key===candidate.insightKey))updatedCount++;else identifiedCount++;const {data:inserted,error:insertError}=await admin.from("founder_pattern_insights").insert({user_id:userId,insight_key:candidate.insightKey,category:candidate.category,headline:candidate.headline,explanation:candidate.explanation,evidence_tier:candidate.evidenceTier,supporting_project_count:candidate.supportingProjectIds.length,contradicting_project_count:candidate.contradictingProjectIds.length,limitations:candidate.limitations,dimensions:candidate.dimensions,evidence_fingerprint:candidate.evidenceFingerprint,status:"pending",calculation_request_id:requestId,generated_at:new Date().toISOString(),data_through:candidate.dataThrough}).select("id").single();if(insertError)throw insertError;const sourceRows=dedupeSources(candidate.sources).map((source)=>({insight_id:inserted.id,user_id:userId,project_id:source.projectId,source_role:source.role,source_kind:source.sourceKind,source_id:source.sourceId,decision_id:source.sourceKind==="decision"?source.sourceId:null,experiment_id:source.sourceKind==="experiment"?source.sourceId:null,reflection_id:source.sourceKind==="reflection"?source.sourceId:null}));if(sourceRows.length){const {error:sourceError}=await admin.from("founder_pattern_insight_sources").insert(sourceRows);if(sourceError)throw sourceError;}}
  const {error:publishError}=await admin.rpc("publish_founder_learning_calculation",{p_user_id:userId,p_request_id:requestId,p_current_fingerprints:fingerprints,p_data_through:dataThrough});if(publishError)throw publishError;
  if(identifiedCount)await logBetaEvent({userId,eventName:"founder_pattern_identified",source:"cross_project_learning",metadata:{pattern_count:identifiedCount,active_pattern_count:fingerprints.length,calculation_version:LEARNING_POLICY.calculationVersion}});
  if(updatedCount)await logBetaEvent({userId,eventName:"founder_pattern_updated",source:"cross_project_learning",metadata:{pattern_count:updatedCount,active_pattern_count:fingerprints.length,calculation_version:LEARNING_POLICY.calculationVersion}});
}

function applyExclusions(candidate:FounderPatternCandidate,excluded?:Set<string>){if(!excluded?.size)return candidate;const sources=candidate.sources.filter((item)=>!excluded.has(item.projectId)),supportingProjectIds=unique(sources.filter((item)=>item.role==="supporting").map((item)=>item.projectId)),contradictingProjectIds=unique(sources.filter((item)=>item.role==="contradicting").map((item)=>item.projectId));const evidenceFingerprint=createHash("sha256").update(JSON.stringify({key:candidate.insightKey,supportingProjectIds:[...supportingProjectIds].sort(),contradictingProjectIds:[...contradictingProjectIds].sort(),sources:sources.map((item)=>`${item.role}:${item.sourceKind}:${item.sourceId}`).sort()})).digest("hex");return{...candidate,sources,supportingProjectIds,contradictingProjectIds,evidenceFingerprint,limitations:[...candidate.limitations,"One or more projects were excluded from this insight by the founder."]};}
function dedupeSources(sources:PatternSource[]){return Array.from(new Map(sources.map((item)=>[`${item.projectId}:${item.role}:${item.sourceKind}:${item.sourceId}`,item])).values());}
async function pagedRows(factory:(from:number,to:number)=>PromiseLike<{data:any[]|null;error:any}>,maxRows:number){const pageSize=500,rows:any[]=[];for(let from=0;from<maxRows;from+=pageSize){const to=Math.min(maxRows-1,from+pageSize-1);const result=await factory(from,to);if(result.error)return{data:null,error:result.error};const page=result.data??[];rows.push(...page);if(page.length<pageSize)break;}return{data:rows,error:null};}
function emptyOverview(query:string,category:string,page:number,migrationPending:boolean,recalculationFailed:boolean):FounderLearningOverview{return{eligibleProjectCount:0,completedProjectCount:0,pausedProjectCount:0,stoppedProjectCount:0,launchedProjectCount:0,revenueProjectCount:0,insights:[],totalInsights:0,page,totalPages:1,query,category,dataThrough:null,limitations:[],migrationPending,recalculationFailed};}
function clean(value:unknown,max:number){return String(value??"").trim().replace(/[\u0000-\u001f\u007f]/g," ").slice(0,max);} function classifyError(error:unknown){const value=error instanceof Error?error.message:String(error);if(/does not exist|schema cache/i.test(value))return"migration_pending";if(/permission|rls|policy/i.test(value))return"authorization";if(/duplicate|conflict/i.test(value))return"concurrency";return"database";} function numberOrNull(value:unknown){const number=Number(value);return Number.isFinite(number)?number:null;} function unique<T>(items:T[]){return Array.from(new Set(items));} function isRecord(value:unknown):value is Record<string,Json|undefined>{return Boolean(value&&typeof value==="object"&&!Array.isArray(value));}
