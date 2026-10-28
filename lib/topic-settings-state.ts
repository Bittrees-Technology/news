import type {Preferences} from './model';
import type {ReaderFilters} from './reader-filters';
// Choice order and unrelated source settings do not change the topic form.
export function topicSettingsState(prefs:Preferences,blocks:Pick<ReaderFilters,'excludedTopics'|'excludedCountries'|'excludedRegions'>){
 return JSON.stringify({topics:[...prefs.topics].sort(),interests:prefs.interests,blocked:prefs.blocked.map(v=>v.trim()).filter(Boolean),length:prefs.length,excludedTopics:[...blocks.excludedTopics].sort(),excludedCountries:[...blocks.excludedCountries].sort(),excludedRegions:[...blocks.excludedRegions].sort()});
}
