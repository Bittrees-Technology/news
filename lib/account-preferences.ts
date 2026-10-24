import {pool} from './db';
import type {Preferences} from './model';
// Reading-interest changes cannot erase saved delivery schedules.
export async function saveAccountPreferences(accountId:string,preferences:Preferences){
 await pool().query("UPDATE accounts SET preferences=$2::jsonb||jsonb_build_object('deliverySubscriptions',COALESCE(preferences->'deliverySubscriptions','{}'::jsonb)) WHERE id=$1",[accountId,JSON.stringify(preferences)]);
}
