import type Database from 'better-sqlite3';
import type { MentorRepository, MentorRow, AvailabilityRuleRow } from './types.js';

export class SqliteMentorRepository implements MentorRepository {
  constructor(private db: Database.Database) {}

  findAll(): MentorRow[] {
    return this.db.prepare('SELECT * FROM mentors ORDER BY id').all() as MentorRow[];
  }

  findById(id: number): MentorRow | undefined {
    return this.db.prepare('SELECT * FROM mentors WHERE id = ?').get(id) as MentorRow | undefined;
  }

  findAvailabilityRules(mentorId: number): AvailabilityRuleRow[] {
    return this.db.prepare(
      'SELECT * FROM availability_rules WHERE mentor_id = ? ORDER BY weekday, start_local',
    ).all(mentorId) as AvailabilityRuleRow[];
  }

  findAllWithRules(): Array<MentorRow & { rules: AvailabilityRuleRow[] }> {
    const mentors = this.findAll();
    const allRules = this.db.prepare(
      'SELECT * FROM availability_rules ORDER BY mentor_id, weekday, start_local',
    ).all() as AvailabilityRuleRow[];

    const rulesByMentor = new Map<number, AvailabilityRuleRow[]>();
    for (const rule of allRules) {
      const list = rulesByMentor.get(rule.mentor_id) ?? [];
      list.push(rule);
      rulesByMentor.set(rule.mentor_id, list);
    }

    return mentors.map((m) => ({
      ...m,
      rules: rulesByMentor.get(m.id) ?? [],
    }));
  }
}
