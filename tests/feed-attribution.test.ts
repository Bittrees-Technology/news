import test from 'node:test';
import assert from 'node:assert/strict';
import {feedParser,feedAuthors,authorNames} from '../lib/feed-attribution';
test('preserves multiple Atom authors without treating emails as names',async()=>{
 const feed=await feedParser.parseString('<feed xmlns="http://www.w3.org/2005/Atom"><title>Test</title><entry><title>Story</title><author><name>Alice</name><email>a@example.org</email></author><author><name>Bob</name></author></entry></feed>');
 assert.deepEqual(feedAuthors(feed.items[0]),['Alice','Bob']);
});
test('preserves repeated RSS creators and deduplicates overlapping bylines',async()=>{
 const feed=await feedParser.parseString('<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Test</title><item><title>Story</title><author>Alice</author><dc:creator>Alice</dc:creator><dc:creator>Bob</dc:creator></item></channel></rss>');
 assert.deepEqual(feedAuthors(feed.items[0]),['Alice','Bob']);
});
test('does not invent or split names and handles missing attribution',()=>{
 assert.deepEqual(feedAuthors({}),[]);
 assert.deepEqual(authorNames(['Doe, Jane','Research and Development Team',{email:'a@example.org'}]),['Doe, Jane','Research and Development Team']);
});
