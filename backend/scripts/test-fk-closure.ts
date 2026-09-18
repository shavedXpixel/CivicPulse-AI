import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testReferentialClosure() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const snapshotDir = path.resolve(__dirname, '../../migration/snapshots/2026-09-17T19-46-45-941Z');

  const departments = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'departments.json'), 'utf8'));
  const users = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'users.json'), 'utf8'));
  const signals = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'signals.json'), 'utf8'));
  const problemClusters = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'problem_clusters.json'), 'utf8'));
  const clusterMembers = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'cluster_members.json'), 'utf8'));

  try {
    await client.query('BEGIN');

    // 1. Dept
    for (const d of departments) {
      await client.query(
        'INSERT INTO departments (id, name, short_name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW());',
        [d.id, d.name, d.short_name, d.description]
      );
    }
    console.log('✓ Departments inserted.');

    // 2. Users
    const uidMap = new Map<string, string>();
    for (const u of users) {
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update('civicpulse:user:' + u.id).digest('hex');
      const uuid = [hash.substring(0, 8), hash.substring(8, 12), '4' + hash.substring(13, 16), 'a' + hash.substring(17, 20), hash.substring(20, 32)].join('-');
      uidMap.set(u.id, uuid);
      await client.query(
        'INSERT INTO users (id, legacy_firebase_uid, email, display_name, role, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW());',
        [uuid, u.id, u.email, u.display_name, u.role, u.status]
      );
    }
    console.log('✓ Users inserted.');

    // 3. Signals
    for (const s of signals) {
      const citizenUuid = s.citizen_id ? (uidMap.get(s.citizen_id) || null) : null;
      await client.query(
        `INSERT INTO signals (
          id, citizen_id, source_type, original_text, category, severity, language, status, processing_status, created_at, submitted_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [
          s.id,
          citizenUuid,
          s.source_type || 'CITIZEN',
          s.original_text,
          s.category || 'OTHER',
          s.severity || 'UNKNOWN',
          s.language || 'en',
          s.status || 'INGESTED',
          s.processing_status || 'PENDING',
          s.created_at,
          s.submitted_at || s.created_at,
          s.updated_at
        ]
      );
    }
    console.log('✓ Signals inserted.');

    // 4. Problems
    for (const p of problemClusters) {
      console.log(`Trying problem: ${p.id}, dept: ${p.department_id}`);
      await client.query(
        `INSERT INTO problem_clusters (
          id, title, category, department_id, status, signal_count, impact_score, created_at, updated_at, first_detected_at, last_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
        [p.id, p.title, p.category, p.department_id, p.status, p.signal_count, p.impact_score, p.created_at, p.updated_at, p.first_detected_at || p.created_at, p.last_updated_at || p.updated_at]
      );
      console.log(`✓ Problem ${p.id} succeeded.`);
    }

    // 5. Cluster Members
    for (const m of clusterMembers) {
      console.log(`Trying member: ${m.id}, prob: ${m.problem_id}, sig: ${m.signal_id}`);
      await client.query(
        'INSERT INTO cluster_members (id, problem_id, signal_id, similarity, created_at) VALUES ($1, $2, $3, $4, $5);',
        [m.id, m.problem_id, m.signal_id, m.similarity, m.created_at]
      );
      console.log(`✓ Member ${m.id} succeeded.`);
    }

    await client.query('ROLLBACK');
  } catch (err: any) {
    console.error('FAILED AT:', err.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

testReferentialClosure().catch(console.error);
