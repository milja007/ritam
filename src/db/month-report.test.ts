/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals";
import { eq } from "drizzle-orm";

import type { ChecklistAnswer, EveningDraft } from "@/core/checkin";
import { parseMonthDiagnosis } from "@/core/diagnosis";
import { createDefaultDraft, toSettingsInput } from "@/core/onboarding";
import { addDays } from "@/core/time/local-date";

import {
  answerReportSuggestion,
  createBlock,
  createRule,
  generateMonthReport,
  generateWeekReport,
  getReport,
  saveEveningCheckin,
  saveSettings,
  type RuleInput,
} from "./repos";
import { reports } from "./schema";
import { createTestDb, testDeps } from "./testing/test-db";

const USER = "user-1";
const OCT = "2026-10";
const NOV = "2026-11";

const day = (start: string, offset: number) => addDays(start, offset) ?? start;

const ans = (
  blockId: string,
  outcome: ChecklistAnswer["outcome"],
): ChecklistAnswer => ({
  blockId,
  outcome,
  comment: "",
  later: outcome === "ok" ? null : "skip",
  laterDate: null,
});

const ruleInput: RuleInput = {
  title: "Bez slatkiša",
  icon: null,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  activeHours: null,
  period: null,
  periodStart: null,
  why: "",
  weight: 3,
};

async function setup() {
  const { db } = await createTestDb();
  const deps = testDeps("2026-12-05T19:00:00.000Z");
  const rule = await createRule(db, USER, ruleInput, deps);
  await saveSettings(
    db,
    USER,
    {
      ...toSettingsInput(createDefaultDraft("hr")),
      scoreRules: true,
      scoreSleep: false,
    },
    deps,
  );
  const closeDay = async (
    date: string,
    done: number,
    total: number,
    kept = true,
  ) => {
    const items: ChecklistAnswer[] = [];
    for (let index = 0; index < total; index += 1) {
      const hour = String(8 + index).padStart(2, "0");
      const block = await createBlock(
        db,
        USER,
        {
          date,
          title: `Blok ${index + 1}`,
          start: `${hour}:00`,
          end: `${hour}:45`,
          taskId: null,
          kind: "task",
          source: "user",
          status: "planned",
        },
        deps,
      );
      items.push(ans(block.id, index < done ? "ok" : "not"));
    }
    const draft: EveningDraft = {
      date,
      items,
      rules: [{ ruleId: rule.id, kept, trigger: kept ? "" : "stres" }],
      rating: 3,
      note: "",
    };
    saveEveningCheckin(db, USER, draft, deps);
  };
  /** `count` dana zaredom od `start`. */
  const closeDays = async (
    start: string,
    count: number,
    done: number,
    total: number,
    kept = true,
  ) => {
    for (let offset = 0; offset < count; offset += 1)
      await closeDay(day(start, offset), done, total, kept);
  };
  return { db, deps, closeDay, closeDays };
}

describe("reports repo — mjesečna dijagnoza", () => {
  it("nije dostupna dok mjesec traje, osim zadnjeg dana nakon večernjeg upita", async () => {
    const { db, deps, closeDay, closeDays } = await setup();
    await closeDays("2026-11-01", 10, 3, 4);
    expect(generateMonthReport(db, USER, NOV, "2026-11-20", deps)).toBeNull();
    expect(generateMonthReport(db, USER, NOV, "2026-11-30", deps)).toBeNull();
    await closeDay("2026-11-30", 3, 4);
    expect(
      generateMonthReport(db, USER, NOV, "2026-11-30", deps)?.diagnosis.month,
    ).toBe(NOV);
  });

  it("neispravan mjesec i mjesec bez zaključenih dana nemaju dijagnozu", async () => {
    const { db, deps, closeDays } = await setup();
    await closeDays("2026-10-05", 5, 3, 4);
    expect(
      generateMonthReport(db, USER, "2026-13", "2026-12-05", deps),
    ).toBeNull();
    expect(generateMonthReport(db, USER, NOV, "2026-12-05", deps)).toBeNull();
    expect(await getReport(db, USER, "month", "2026-11-01")).toBeNull();
  });

  it("sprema dijagnozu mjeseca bez prijedloga za prihvaćanje i uspoređuje s prošlim mjesecom", async () => {
    const { db, deps, closeDays } = await setup();
    await closeDays("2026-10-01", 12, 1, 4);
    await closeDays("2026-11-01", 12, 4, 4);
    const result = generateMonthReport(db, USER, NOV, "2026-12-05", deps);
    expect(result?.diagnosis).toMatchObject({
      month: NOV,
      start: "2026-11-01",
      end: "2026-11-30",
      trend: "better",
    });
    expect(result?.diagnosis.ideas.length).toBeGreaterThanOrEqual(1);
    expect(result?.diagnosis.ideas.length).toBeLessThanOrEqual(2);
    expect(result?.report).toMatchObject({
      period: "month",
      periodStart: "2026-11-01",
      promptVersion: "local-month-v1",
      suggestion: null,
      suggestionAccepted: null,
    });
    const stored = await getReport(db, USER, "month", "2026-11-01");
    expect(parseMonthDiagnosis(stored?.sections)).toEqual(result?.diagnosis);
    expect(stored?.stats).toMatchObject({
      current: { recorded: 12 },
      previous: { recorded: 12 },
    });
    expect(
      answerReportSuggestion(db, USER, "month", "2026-11-01", true, deps),
    ).toBe(false);
  });

  it("rekord mjeseca broji samo ranije mjesece s dovoljno dana", async () => {
    const { db, deps, closeDays } = await setup();
    await closeDays("2026-10-01", 12, 2, 4);
    await closeDays("2026-11-01", 12, 4, 4);
    const praise = generateMonthReport(
      db,
      USER,
      NOV,
      "2026-12-05",
      deps,
    )?.diagnosis.praise.map((line) => line.key);
    expect(praise).toContain("praise.record");
    // Listopad nema raniji ubrojen mjesec: nema rekorda.
    expect(
      generateMonthReport(
        db,
        USER,
        OCT,
        "2026-12-05",
        deps,
      )?.diagnosis.praise.map((line) => line.key),
    ).not.toContain("praise.record");
  });

  it("pregled promjena broji odgovore tjednih dijagnoza tog mjeseca", async () => {
    const { db, deps, closeDays } = await setup();
    await closeDays("2026-11-02", 14, 1, 4, false);
    generateWeekReport(db, USER, "2026-11-02", "2026-12-05", deps);
    answerReportSuggestion(db, USER, "week", "2026-11-02", false, deps);
    const diagnosis = generateMonthReport(
      db,
      USER,
      NOV,
      "2026-12-05",
      deps,
    )?.diagnosis;
    expect(diagnosis?.changes).toEqual({ accepted: 0, rejected: 1 });
    expect(diagnosis?.noticed[0]).toEqual({
      key: "noticed.changes",
      params: { accepted: 0, rejected: 1 },
    });
  });

  it("ponovni poziv bez promjene ništa ne piše; s promjenom osvježi isti red", async () => {
    const { db, deps, closeDay, closeDays } = await setup();
    await closeDays("2026-11-01", 10, 2, 4);
    const first = generateMonthReport(
      db,
      USER,
      NOV,
      "2026-12-05",
      deps,
    )?.report;
    expect(
      generateMonthReport(db, USER, NOV, "2026-12-05", deps)?.report.updatedAt,
    ).toBe(first?.updatedAt);
    await closeDay("2026-11-20", 4, 4);
    const third = generateMonthReport(
      db,
      USER,
      NOV,
      "2026-12-05",
      deps,
    )?.report;
    expect(third?.id).toBe(first?.id);
    expect((third?.updatedAt ?? "") > (first?.updatedAt ?? "")).toBe(true);
    expect(
      await db.select().from(reports).where(eq(reports.period, "month")).all(),
    ).toHaveLength(1);
  });

  it("dijagnoze su po korisniku", async () => {
    const { db, deps, closeDays } = await setup();
    await closeDays("2026-11-01", 10, 2, 4);
    generateMonthReport(db, USER, NOV, "2026-12-05", deps);
    expect(
      generateMonthReport(db, "drugi", NOV, "2026-12-05", deps),
    ).toBeNull();
    expect(await getReport(db, "drugi", "month", "2026-11-01")).toBeNull();
  });
});
