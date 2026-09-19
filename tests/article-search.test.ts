import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesArticleSearch} from '../lib/article-search';
const item={title:'Ciência in Portugal',excerpt:'Original excerpt',summary:'Ocean research',briefing_preview:'Scientists measured warming',translation:{title:'Science in Portugal',summary:'New coastal observations',language:'pt',model:'test'}};
test('search ignores case, accents and surrounding spaces and requires every word',()=>{
 assert.equal(matchesArticleSearch(item,'  CIENCIA portugal '),true);
 assert.equal(matchesArticleSearch(item,'science warming'),true);
 assert.equal(matchesArticleSearch(item,'science volcano'),false);
 assert.equal(matchesArticleSearch(item,'  '),true);
});
test('title and summary scopes include original and displayed translations and previews',()=>{
 assert.equal(matchesArticleSearch(item,'science','title'),true);
 assert.equal(matchesArticleSearch(item,'warming','title'),false);
 assert.equal(matchesArticleSearch(item,'science','summary'),false);
 for(const text of ['warming','coastal','ocean','excerpt'])assert.equal(matchesArticleSearch(item,text,'summary'),true);
 assert.equal(matchesArticleSearch({title:'Only title',excerpt:''},'word','summary'),false);
});
