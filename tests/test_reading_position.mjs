import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const helper=require('../reading-position.js');

function storage(){
  const map=new Map();
  return {
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,value)=>{map.set(key,String(value))},
    removeItem:key=>map.delete(key),
    entries:()=>[...map]
  };
}
const fresh=storage();
assert.equal(helper.read(fresh),null,'First visit must have no resume prompt');
assert.equal(helper.fraction(250,100,500),.375);
assert.equal(helper.fraction(2000,100,500),1);
assert.equal(helper.fraction(-200,100,500),0);
assert.equal(helper.coordinate(2000,6000,.42,200),3480);

// Save a precise section + an approximate offset in that section.
const checkpoint={
  chapterId:'ch07',anchorId:'ch07-sec04',
  chapterFraction:.61,anchorFraction:.42,savedAt:123456789
};
assert.equal(helper.write(fresh,checkpoint),true);
const before=helper.read(fresh);
assert.deepEqual(before,{v:2,...checkpoint});
assert.ok(fresh.getItem(helper.KEY),'Checkpoint must persist as local storage');

// A restarted tab or installed app uses a fresh JavaScript instance but the
// same browser-managed localStorage. This is not part of the service-worker cache.
delete require.cache[require.resolve('../reading-position.js')];
const afterRestart=require('../reading-position.js');
assert.deepEqual(afterRestart.read(fresh),before,'Close and restart preserves state');

// A newly published edition can have different paragraph lengths and offsets;
// the section-relative fraction still maps to the revised document.
const oldPosition=helper.coordinate(2000,6000,before.anchorFraction,150);
const updatedPosition=helper.coordinate(3300,9300,afterRestart.read(fresh).anchorFraction,150);
assert.equal(oldPosition,3530);
assert.equal(updatedPosition,5670);
assert.equal(afterRestart.read(fresh).chapterId,'ch07');

// If a section is no longer present, the stored chapterFraction remains a
// defensible fallback. The UI resolves it against the new chapter boundaries.
assert.equal(helper.coordinate(7000,27000,before.chapterFraction,150),19050);
const modified=helper.normalize({...checkpoint,anchorId:'ch03-sec01'});
assert.equal(modified.anchorId,'ch07','Reject an unrelated section');
assert.equal(helper.normalize({...checkpoint,anchorId:'ch07-sec999'}).anchorId,'ch07-sec999');
assert.equal(helper.normalize({...checkpoint,anchorFraction:2,chapterFraction:-1}).anchorFraction,1);
assert.equal(helper.normalize({...checkpoint,anchorFraction:2,chapterFraction:-1}).chapterFraction,0);
assert.equal(helper.normalize({chapterId:'ch99'}),null);

// Previous installed releases stored only an anchor ID. Migrate it rather than
// silently losing readers' place when the updated service worker activates.
const legacy=storage();
legacy.setItem(helper.LEGACY_KEY,'ch12-sec05');
const migrated=helper.read(legacy);
assert.equal(migrated.chapterId,'ch12');
assert.equal(migrated.anchorId,'ch12-sec05');
assert.equal(migrated.anchorFraction,0);
assert.equal(legacy.getItem(helper.LEGACY_KEY),null);
assert.deepEqual(helper.read(legacy),migrated);

// Failed writes (private browsing, full storage) must not break navigation.
const blocked={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}};
assert.equal(helper.read(blocked),null);
assert.equal(helper.write(blocked,checkpoint),false);

console.log('PASS: reading checkpoint, browser/app restart, new edition geometry, migration, safe fallback');
