import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { readFile } from 'node:fs/promises';
async function moduleAt(path) {
  const source = await readFile(new URL('../' + path, import.meta.url), 'utf8');
  const outputText = stripTypeScriptTypes(source);
  return import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
}
const {buildAnalytics}=await moduleAt('src/lib/analytics.ts');
const {summarizeReleases}=await moduleAt('src/lib/releaseAnalytics.ts');
const now=Date.now();
const event=(id,name,label,sessionId='phone')=>({id,name,label,sessionId,site:'main',platform:'android',device:'mobile',path:'/movie/157336',timestamp:now-1000});
const rows=[event('1','app_install','1.2.5'),event('1','app_install','1.2.5'),event('2','app_install','1.2.5'),event('3','cta_click','download-queued'),event('4','cta_click','download-complete'),event('5','cta_click','download-failed'),event('6','cta_click','download-resumed'),event('7','cta_click','torrent-open'),event('8','apk_download','mobile-1.2.5')];
const result=buildAnalytics(rows,now,7,'android');
assert.equal(result.firstLaunches,1);assert.deepEqual(result.versions,[{version:'1.2.5',launches:1}]);
assert.deepEqual(result.downloads,{queued:1,complete:1,failed:1,paused:0,resumed:1,cancelled:0});
assert.equal(result.titles[0].downloads,1);assert.equal(result.titles[0].torrents,1);assert.equal(result.downloadClicks,1);
assert.equal(buildAnalytics(rows,now,7,'web').downloads.queued,0);
const release=(tag,date,assets)=>({tag_name:tag,published_at:date,html_url:'https://github.com/heisbaed/cine-verse/releases/tag/'+tag,assets});
const totals=summarizeReleases([release('v1.2.3','2026-10-05',[{name:'app.apk',download_count:12}]),release('v1.2.5','2026-11-14',[{name:'app.apk',download_count:4},{name:'app.apk.sha256',download_count:90}]),release('tv-latest','2026-11-15',[{name:'cine-verse-tv.apk',download_count:7}])],'repo','phone','mobile');
assert.equal(totals.total,16);assert.equal(totals.latest.version,'v1.2.5');assert.equal(totals.latest.downloads,4);
console.log('PASS analytics deduplication, version first launches, download actions, platform filters and release totals');
