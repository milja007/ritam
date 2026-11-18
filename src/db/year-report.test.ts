/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals";

import type { ChecklistAnswer, EveningDraft } from "@/core/checkin";
import { parseYearDiagnosis, writeYearReportRequest, type LlmYearText } from "@/core/diagnosis";

import { parseWriteYearReportRequest } from "../../supabase/functions/_shared/report-logic";
import { createDefaultDraft, toSettingsInput } from "@/core/onboarding";
import { addDays } from "@/core/time/local-date";

import {
  answerReportSuggestion,
  createBlock,
  createRule,
  generateMonthReport,
  generateWeekReport,
  generateYearReport,
  loadYearWriteReportData,
  saveYearReportText,
  getReport,
  saveEveningCheckin,
  saveSettings,
  type RuleInput,
} from "./repos";
import { createTestDb, testDeps } from "./testing/test-db";

const USER = "user-1";
const YEAR = "2026";

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
  const deps = testDeps("2027-01-05T19:00:00.000Z");
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

describe("reports repo — godišnja dijagnoza (37b)", () => {
  it("nije dostupna dok godina traje, osim 31. 12. nakon večernjeg upita", async () => {
    const { db, deps, closeDay, closeDays } = await setup();
    await closeDays("2026-12-20", 5, 3, 4);
    expect(generateYearReport(db, USER, YEAR, "2026-12-30", deps)).toBeNull();
    expect(generateYearReport(db, USER, YEAR, "2026-12-31", deps)).toBeNull();
    await closeDay("2026-12-31", 3, 4);
    expect(generateYearReport(db, USER, YEAR, "2026-12-31", deps)?.diagnosis.year).toBe(YEAR);
  });

  it("neispravna godina i godina bez zaključenih dana nemaju dijagnozu", async () => {
    const { db, deps, closeDays } = await setup();
    await closeDays("2026-12-20", 3, 3, 4);
    expect(generateYearReport(db, USER, "26", "2027-01-05", deps)).toBeNull();
    expect(generateYearReport(db, USER, "2025", "2027-01-05", deps)).toBeNull();
    expect(await getReport(db, USER, "year", "2025-01-01")).toBeNull();
  });

  it("sprema dijagnozu godine bez prijedloga, usporedba s prošlom godinom, bez promjene ne piše", async () => {
    const { db, deps, closeDays } = await setup();
    await closeDays("2025-12-20", 8, 1, 4);
    await closeDays("2026-12-01", 10, 4, 4);
    const result = generateYearReport(db, USER, YEAR, "2027-01-05", deps);
    expect(result?.diagnosis).toMatchObject({ year: YEAR, start: "2026-01-01", end: "2026-12-31", trend: "better" });
    expect(result?.diagnosis.months[11]).not.toBeNull();
    expect(result?.diagnosis.months[0]).toBeNull();
    expect(result?.report).toMatchObject({
      period: "year",
      periodStart: "2026-01-01",
      promptVersion: "local-year-v1",
      suggestion: null,
      suggestionAccepted: null,
    });
    const stored = await getReport(db, USER, "year", "2026-01-01");
    expect(parseYearDiagnosis(stored?.sections)).toEqual(result?.diagnosis);
    expect(stored?.stats).toMatchObject({ current: { recorded: 10 }, previous: { recorded: 8 } });
    expect(answerReportSuggestion(db, USER, "year", "2026-01-01", true, deps)).toBe(false);

    const later = testDeps("2027-01-06T19:00:00.000Z");
    const again = generateYearReport(db, USER, YEAR, "2027-01-06", later);
    expect(again?.report.updatedAt).toBe(result?.report.updatedAt);
  });

  it("pregled promjena broji tjedne dijagnoze godine", async () => {
    const { db, deps, closeDays } = await setup();
    await closeDays("2026-11-02", 14, 1, 4, false);
    generateWeekReport(db, USER, "2026-11-02", "2027-01-05", deps);
    answerReportSuggestion(db, USER, "week", "2026-11-02", false, deps);
    const diagnosis = generateYearReport(db, USER, YEAR, "2027-01-05", deps)?.diagnosis;
    expect(diagnosis?.changes).toEqual({ accepted: 0, rejected: 1 });
  });
});

describe("reports repo — godišnja dijagnoza riječima (korak 31e)", () => {
  const text: LlmYearText = {
    version: "llm-year-v1",
    summary: "Godina je bila bolja od prošle.",
    praise: [],
    noticed: ["Prosinac je najjači."],
    problems: [],
    ideasWhy: null,
  };

  it("bez godišnje dijagnoze nema podataka ni spremanja", async () => {
    const { db, deps } = await setup();
    expect(await loadYearWriteReportData(db, USER, "2026-01-01")).toBeNull();
    expect(saveYearReportText(db, USER, "2026-01-01", text, "{}", deps)).toBeNull();
  });

  it("podaci: statistika, mjesečne dijagnoze te godine, ranije godišnje; zahtjev prolazi provjeru", async () => {
    const { db, deps, closeDays } = await setup();
    await closeDays("2025-12-20", 8, 1, 4);
    await closeDays("2026-11-25", 10, 4, 4);
    expect(generateYearReport(db, USER, "2025", "2027-01-05", deps)).not.toBeNull();
    expect(generateMonthReport(db, USER, "2026-11", "2027-01-05", deps)).not.toBeNull();
    expect(generateMonthReport(db, USER, "2026-12", "2027-01-05", deps)).not.toBeNull();
    expect(generateYearReport(db, USER, YEAR, "2027-01-05", deps)).not.toBeNull();
    const data = await loadYearWriteReportData(db, USER, "2026-01-01");
    expect(data?.current.recorded).toBe(10);
    expect(data?.months.map((m) => m.month)).toEqual(["2026-11", "2026-12"]);
    expect(data?.previousReports.map((r) => r.start)).toEqual(["2025-01-01"]);
    if (!data) return;
    const request = writeYearReportRequest({
      locale: "hr",
      diagnosis: data.diagnosis,
      current: data.current,
      previous: data.previous,
      monthSummaries: data.months.map(({ month, diagnosis }) => ({ month, summary: diagnosis.summary.key })),
      previousReports: data.previousReports,
      renderLine: (line) => line.key,
    });
    const parsed = parseWriteYearReportRequest(JSON.parse(JSON.stringify(request)));
    expect(parsed?.year.end).toBe("2026-12-31");
    expect(parsed?.previousYear?.start).toBe("2025-01-01");
    expect(parsed?.months.filter((m) => m.summary !== null).map((m) => m.month)).toEqual(["2026-11", "2026-12"]);
    expect(parsed?.previous.map((p) => p.date)).toEqual(["2025-01-01"]);
  });

  it("tekst se sprema, preživi ponovno generiranje, a otpada kad se godina promijeni", async () => {
    const { db, deps, closeDay, closeDays } = await setup();
    await closeDays("2026-12-20", 12, 2, 4);
    generateYearReport(db, USER, YEAR, "2027-01-05", deps);
    const data = await loadYearWriteReportData(db, USER, "2026-01-01");
    expect(saveYearReportText(db, USER, "2026-01-01", text, data?.basis ?? "", deps)?.llm).toEqual(text);
    expect(parseYearDiagnosis((await getReport(db, USER, "year", "2026-01-01"))?.sections)?.llm).toEqual(text);
    expect(generateYearReport(db, USER, YEAR, "2027-01-05", deps)?.diagnosis.llm).toEqual(text);
    await closeDay("2026-12-10", 0, 4);
    expect(generateYearReport(db, USER, YEAR, "2027-01-05", deps)?.diagnosis.llm).toBeUndefined();
    expect(saveYearReportText(db, USER, "2026-01-01", text, data?.basis ?? "", deps)).toBeNull();
  });
});
