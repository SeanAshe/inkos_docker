import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { formatRecentSummaries, readSubplotBoard } from "../agents/planner-context.js";
import { readCharacterContext, readStoryFrame, readVolumeMap } from "../utils/outline-paths.js";

// Read-only view of the canonical book used as forecast input. Everything in
// here MUST stay side-effect free: building a forecast context never creates
// or repairs canonical files (that is why StateManager.loadControlDocuments,
// which seeds defaults, is deliberately not used).

const RECENT_SUMMARY_LIMIT = 8;

export interface ForecastContextSections {
  readonly authorIntent: string;
  readonly currentFocus: string;
  readonly currentState: string;
  readonly pendingHooks: string;
  readonly storyFrame: string;
  readonly volumeMap: string;
  readonly recentChapterSummaries: string;
  readonly characterContext: string;
  readonly subplotBoard: string;
}

export interface ForecastContext {
  readonly bookId: string;
  readonly bookTitle: string;
  readonly language: "zh" | "en";
  readonly baseChapter: number;
  readonly contextFingerprint: string;
  readonly sections: ForecastContextSections;
}

export async function buildForecastContext(params: {
  readonly bookDir: string;
  readonly bookId: string;
}): Promise<ForecastContext> {
  const { bookDir, bookId } = params;
  const storyDir = join(bookDir, "story");

  const [bookConfig, baseChapter, stateFiles] = await Promise.all([
    readBookConfig(bookDir),
    resolveBaseChapter(bookDir),
    readStateFiles(bookDir),
  ]);

  const [authorIntent, currentFocus, currentState, pendingHooks] = await Promise.all([
    readOrEmpty(join(storyDir, "author_intent.md")),
    readOrEmpty(join(storyDir, "current_focus.md")),
    readOrEmpty(join(storyDir, "current_state.md")),
    readOrEmpty(join(storyDir, "pending_hooks.md")),
  ]);

  const [storyFrame, volumeMap, characterContext, subplotBoard, chapterSummariesRaw] = await Promise.all([
    readStoryFrame(bookDir),
    readVolumeMap(bookDir),
    readCharacterContext(bookDir),
    readSubplotBoard(storyDir),
    readOrEmpty(join(storyDir, "chapter_summaries.md")),
  ]);

  const contextFingerprint = computeContextFingerprint({
    baseChapter,
    files: [
      ...stateFiles.map(({ name, content }) => [`story/state/${name}`, content] as const),
      ["story/author_intent.md", authorIntent] as const,
      ["story/current_focus.md", currentFocus] as const,
      ["story/current_state.md", currentState] as const,
      ["story/pending_hooks.md", pendingHooks] as const,
    ],
  });

  return {
    bookId,
    bookTitle: bookConfig.title || bookId,
    language: bookConfig.language,
    baseChapter,
    contextFingerprint,
    sections: {
      authorIntent,
      currentFocus,
      currentState,
      pendingHooks,
      storyFrame,
      volumeMap,
      recentChapterSummaries: chapterSummariesRaw.trim()
        ? formatRecentSummaries(chapterSummariesRaw, baseChapter + 1, RECENT_SUMMARY_LIMIT)
        : "",
      characterContext,
      subplotBoard,
    },
  };
}

/**
 * Content hash over the canonical forecast inputs (chapter count + state and
 * control document contents). Deliberately mtime-free so copies, checkouts
 * and CI runs produce identical fingerprints for identical canon.
 */
export function computeContextFingerprint(input: {
  readonly baseChapter: number;
  readonly files: ReadonlyArray<readonly [string, string]>;
}): string {
  const canonical = JSON.stringify({
    baseChapter: input.baseChapter,
    files: [...input.files].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function renderForecastContextMarkdown(context: ForecastContext): string {
  const zh = context.language === "zh";
  const sectionList: ReadonlyArray<readonly [string, string]> = [
    [zh ? "作者意图" : "Author intent", context.sections.authorIntent],
    [zh ? "当前聚焦" : "Current focus", context.sections.currentFocus],
    [zh ? "当前状态" : "Current state", context.sections.currentState],
    [zh ? "伏笔与钩子" : "Pending hooks", context.sections.pendingHooks],
    [zh ? "故事框架" : "Story frame", context.sections.storyFrame],
    [zh ? "卷映射" : "Volume map", context.sections.volumeMap],
    [zh ? "近期章节摘要" : "Recent chapter summaries", context.sections.recentChapterSummaries],
    [zh ? "人物与关系" : "Characters and relationships", context.sections.characterContext],
    [zh ? "支线看板" : "Subplot board", context.sections.subplotBoard],
  ];

  const blocks = [
    zh
      ? `# 正史上下文（《${context.bookTitle}》，已完成至第 ${context.baseChapter} 章）`
      : `# Canonical context ("${context.bookTitle}", written through chapter ${context.baseChapter})`,
    ...sectionList
      .filter(([, content]) => content.trim())
      .map(([heading, content]) => `## ${heading}\n\n${content.trim()}`),
  ];
  return blocks.join("\n\n");
}

async function readBookConfig(bookDir: string): Promise<{ readonly title: string; readonly language: "zh" | "en" }> {
  try {
    const raw = await readFile(join(bookDir, "book.json"), "utf-8");
    const parsed = JSON.parse(raw) as { title?: unknown; language?: unknown };
    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      language: parsed.language === "en" ? "en" : "zh",
    };
  } catch {
    return { title: "", language: "zh" };
  }
}

/**
 * Highest chapter number present on disk. Forecasts key their staleness on
 * this value: a new canonical chapter invalidates old forecasts.
 */
async function resolveBaseChapter(bookDir: string): Promise<number> {
  let files: string[];
  try {
    files = await readdir(join(bookDir, "chapters"));
  } catch {
    return 0;
  }
  let max = 0;
  for (const file of files) {
    const match = file.match(/^(\d+)[_-]?.*\.md$/);
    if (!match) continue;
    const number = Number.parseInt(match[1]!, 10);
    if (Number.isFinite(number) && number > max) max = number;
  }
  return max;
}

async function readStateFiles(bookDir: string): Promise<ReadonlyArray<{ readonly name: string; readonly content: string }>> {
  const stateDir = join(bookDir, "story", "state");
  let names: string[];
  try {
    names = (await readdir(stateDir)).filter((name) => name.endsWith(".json")).sort();
  } catch {
    return [];
  }
  return Promise.all(names.map(async (name) => ({
    name,
    content: await readOrEmpty(join(stateDir, name)),
  })));
}

async function readOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}
