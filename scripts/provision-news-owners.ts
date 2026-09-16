// Explicitly authorized News recovery identities. Never resolves authority from a display name.
import { pool, tx } from "../lib/db";
import { randomUUID } from "node:crypto";
const grants = [
  ["email", "raging@bittrees.org"],
  ["wallet", "0xe5350d96fc3161bf5c385843ec5ee24e8b465b2f"],
];
await tx(async (db) => {
  for (const [kind, value] of grants) {
    await db.query(
      "INSERT INTO news_role_grants(kind,value,role,protected) VALUES($1,$2,'super_admin',true) ON CONFLICT(kind,value) DO UPDATE SET role='super_admin',protected=true,updated_at=now()",
      [kind, value],
    );
    await db.query("INSERT INTO news_staff_audit(id,actor,action,detail) VALUES($1,$2,'bootstrap_owner',$3)", [randomUUID(), '00000000-0000-0000-0000-000000000000', JSON.stringify({kind,value,role:'super_admin',reason:'Explicit owner request; verified login required'})]);
  }
});
console.log(
  "News protected super-admin grants configured for the approved email and resolved wallet. Verified sign-in is required.",
);
await pool().end();
