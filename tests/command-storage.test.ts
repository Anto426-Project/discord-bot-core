import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { SqliteDiscordCommandPublicationSnapshotAdapter } from "../src/node-storage.js";
import { bootstrapDiscordCommandOwnership } from "../src/command-ownership.js";
import type { DiscordApplicationCommandsRestPort } from "../src/command-publisher.js";
const scope = {kind:"global",ownership:"provider_command_id",ownerKey:"bot",applicationId:"111111111111111111"} as const;
test("SQLite snapshots survive reopen and expired leases cannot write",async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),"core-storage-test-"));
  let now=1000;
  const one=new SqliteDiscordCommandPublicationSnapshotAdapter(path.join(dir,"state.sqlite"),()=>now);
  const two=new SqliteDiscordCommandPublicationSnapshotAdapter(path.join(dir,"state.sqlite"),()=>now);
  try {
    const lease=await one.claimScope(scope,100);assert.ok(lease);
    assert.equal(await two.claimScope({...scope,ownerKey:"other"},100),null);
    const snapshot={schemaVersion:5,revision:0,ownerKey:scope.ownerKey,scopeKind:scope.kind,applicationId:scope.applicationId,guildId:null,catalogFingerprint:"a".repeat(64),commands:[],pending:null} as const;
    await one.saveSnapshot(scope,lease,snapshot);
    now=1101;
    const next=await two.claimScope(scope,100);assert.ok(next);
    await assert.rejects(one.saveSnapshot(scope,lease,snapshot));
    await one.releaseScope(scope,lease);
    assert.deepEqual(await two.loadSnapshot(scope,next),snapshot);
  } finally {one.close();two.close();await rm(dir,{recursive:true,force:true});}
});
test("ownership bootstrap verifies fingerprints and ignores unrelated commands",async()=>{
  const store=new SqliteDiscordCommandPublicationSnapshotAdapter(":memory:");
  const rest:DiscordApplicationCommandsRestPort={listApplicationCommands:async()=>[{id:"222222222222222222",kind:"chat_input",name:"old",fingerprint:"a".repeat(64)},{id:"333333333333333333",kind:"chat_input",name:"foreign",fingerprint:"b".repeat(64)}],createApplicationCommand:async()=>{throw new Error("unused");},updateApplicationCommand:async()=>{throw new Error("unused");},deleteApplicationCommand:async()=>{throw new Error("unused");}};
  try {
    await assert.rejects(bootstrapDiscordCommandOwnership(scope,[{key:"new",commandName:"old",fingerprints:["c".repeat(64)]}],rest,store));
    await bootstrapDiscordCommandOwnership(scope,[{key:"new",commandName:"old",fingerprints:["a".repeat(64)]}],rest,store);
    const lease=await store.claimScope(scope,1000);assert.ok(lease);
    assert.deepEqual((await store.loadSnapshot(scope,lease))?.commands.map(x=>x.providerCommandId),["222222222222222222"]);
  } finally {store.close();}
});
