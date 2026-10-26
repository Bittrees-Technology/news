import {communityAdjustment} from './feedback';
export type InterestEvidence={readers:number;votes:number;total:number};
// One averaged vote per reader/topic; small cohorts never influence public ranking.
// Interest is usefulness feedback, not truth, source reliability or model authority.
export function learnedInterest(e?:InterestEvidence){
 return !e||e.votes<20?0:communityAdjustment(e.total,e.readers,3);
}
export type TopThreeLearning={topics:Record<string,InterestEvidence>;stories:Record<string,InterestEvidence>};
export function interestAdjustment(topic:string,id:string,learning?:TopThreeLearning){
 const story=learning?.stories[id];
 return Math.round((learnedInterest(learning?.topics[topic])+(story?communityAdjustment(story.total,story.readers,3):0))*10)/10;
}
