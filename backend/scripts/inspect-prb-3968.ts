import fs from 'fs';
import path from 'path';

const raw = fs.readFileSync(path.resolve(__dirname, 'current_db_state.json'), 'utf-8');
const state = JSON.parse(raw);

console.log('=== PROBLEM CLUSTERS ===');
for (const p of state.problem_clusters) {
  const { centroid_embedding, ...rest } = p;
  console.log(JSON.stringify(rest, null, 2));
}

console.log('\n=== SIGNALS (Count: ' + state.signals.length + ') ===');
for (const s of state.signals) {
  const { embedding, ...rest } = s;
  console.log(`ID: ${s.id} | cluster: ${s.problem_cluster_id || s.cluster_id} | status: ${s.status} | created: ${s.created_at} | text: "${(s.original_text || s.text || '').substring(0, 70)}"`);
}

console.log('\n=== CLUSTER MEMBERS FOR PRB-2026-3968 & PRB-2026-4047 ===');
for (const m of state.cluster_members) {
  if (m.cluster_id === 'PRB-2026-3968' || m.cluster_id === 'PRB-2026-4047' || m.problem_id === 'PRB-2026-3968' || m.problem_id === 'PRB-2026-4047') {
    console.log(JSON.stringify(m, null, 2));
  }
}

console.log('\n=== ALL OTHER CLUSTER MEMBERS ===');
for (const m of state.cluster_members) {
  if (m.cluster_id !== 'PRB-2026-3968' && m.cluster_id !== 'PRB-2026-4047') {
    console.log(`Member ${m.id}: cluster_id=${m.cluster_id}, signal_id=${m.signal_id}, added_at=${m.added_at}`);
  }
}

console.log('\n=== ASSIGNMENTS FOR PRB-2026-3968 & PRB-2026-4047 ===');
for (const a of state.assignments) {
  console.log(JSON.stringify(a, null, 2));
}

console.log('\n=== PROBLEM ACTIONS FOR PRB-2026-3968 & PRB-2026-4047 ===');
for (const act of state.problem_actions) {
  if (act.problem_id === 'PRB-2026-3968' || act.problem_id === 'PRB-2026-4047') {
    console.log(JSON.stringify(act, null, 2));
  }
}

console.log('\n=== VERIFICATION RESULTS FOR PRB-2026-3968 & PRB-2026-4047 ===');
for (const vr of state.verification_results) {
  if (vr.problem_id === 'PRB-2026-3968' || vr.problem_id === 'PRB-2026-4047') {
    console.log(JSON.stringify(vr, null, 2));
  }
}
