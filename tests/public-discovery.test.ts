import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BriefingReader} from '../components/briefing-reader';
// tsx's test transform uses the classic JSX runtime for imported TSX.
(globalThis as any).React=React;
test('public briefings render before personal reading state is available',()=>{
 const html=renderToStaticMarkup(React.createElement(BriefingReader,{initial:{entries:[{id:'a'.repeat(64),title:'Public evidence fixture',url:'https://example.org/article',published_at:'2026-10-26T00:00:00Z',source_id:'fixture',evidence:{kind:'feed'},evidence_label:'Feed evidence',excerpt:'Public source summary'}],next:'b'.repeat(64),snapshot:'2026-10-26T00:00:00Z'}}));
 assert.match(html,/Public evidence fixture/);
 assert.match(html,/Read full article at source/);
 assert.match(html,/Older briefings/);
 assert.doesNotMatch(html,/Loading read status/);
 assert.match(html,/<button[^>]*disabled[^>]*aria-label="Mark as read/);
});
