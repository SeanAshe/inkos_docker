import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt } from "../agent/agent-system-prompt.js";

describe("buildAgentSystemPrompt", () => {
  describe("mode isolation", () => {
    it("defaults no-book sessions to plain chat, not book creation", () => {
      const prompt = buildAgentSystemPrompt(null, "zh");
      expect(prompt).toContain("普通聊天助手");
      expect(prompt).toContain("这里不是自动生产入口");
      expect(prompt).toContain("propose_action");
      expect(prompt).not.toContain("sub_agent");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("generate_cover");
      expect(prompt).not.toContain("play_start");
      expect(prompt).not.toContain("architect");
    });

    it("defaults active-book sessions to book mode", () => {
      const prompt = buildAgentSystemPrompt("my-book", "zh");
      expect(prompt).toContain("当前正在处理书籍「my-book」");
      expect(prompt).toContain("sub_agent");
      expect(prompt).toContain("writer");
    });

    it("English plain chat also has no production tool instructions", () => {
      const prompt = buildAgentSystemPrompt(null, "en");
      expect(prompt).toContain("general chat assistant");
      expect(prompt).toContain("not an automatic production surface");
      expect(prompt).toContain("propose_action");
      expect(prompt).not.toContain("sub_agent");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("generate_cover");
      expect(prompt).not.toContain("play_start");
      expect(prompt).not.toContain("architect");
    });

    it("requires self-contained proposed action instructions", () => {
      const zhPrompt = buildAgentSystemPrompt(null, "zh", "chat");
      const enPrompt = buildAgentSystemPrompt(null, "en", "chat");
      expect(zhPrompt).toContain("instruction 必须自包含");
      expect(zhPrompt).toContain("不要让下一条 session 依赖上一轮聊天上下文猜");
      expect(enPrompt).toContain("instruction must be self-contained");
      expect(enPrompt).toContain("Do not make the next session infer missing context");
    });
  });

  describe("book-create mode", () => {
    it("gates long-form creation behind a confirmation proposal", () => {
      const prompt = buildAgentSystemPrompt(null, "zh", "book-create");
      expect(prompt).toContain("建书助手");
      expect(prompt).toContain("确认是否创建");
      expect(prompt).toContain("分阶段");
      expect(prompt).toContain("世界观与规则");
      expect(prompt).toContain("结构与约束");
      expect(prompt).toContain("propose_action");
      expect(prompt).toContain("create_book");
      expect(prompt).not.toContain("sub_agent");
      expect(prompt).not.toContain("architect");
      expect(prompt).toContain("标题");
      expect(prompt).toContain("题材");
      expect(prompt).toContain("世界观");
      expect(prompt).toContain("主角");
      expect(prompt).toContain("核心冲突");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("generate_cover");
      expect(prompt).not.toContain("play_start");
      expect(prompt).not.toContain("play_step");
    });

    it("runs architect only after book creation is confirmed", () => {
      const prompt = buildAgentSystemPrompt(null, "zh", "book-create", {
        actionSource: "button",
        requestedIntent: "create_book",
      });
      expect(prompt).toContain("sub_agent");
      expect(prompt).toContain("architect");
      expect(prompt).toContain("创建长篇");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("play_start");
    });

    it("English book-create mode is isolated from short and play before confirmation", () => {
      const prompt = buildAgentSystemPrompt(null, "en", "book-create");
      expect(prompt).toContain("book creation assistant");
      expect(prompt).toContain("propose_action");
      expect(prompt).not.toContain("agent=\"architect\"");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("play_start");
    });
  });

  describe("short mode", () => {
    it("gates short-fiction and cover production behind a confirmation proposal", () => {
      const prompt = buildAgentSystemPrompt(null, "zh", "short");
      expect(prompt).toContain("InkOS Short 助手");
      expect(prompt).toContain("propose_action");
      expect(prompt).toContain("short_run");
      expect(prompt).toContain("generate_cover");
      expect(prompt).toContain("先确认方案");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("sub_agent");
      expect(prompt).not.toContain("architect");
      expect(prompt).not.toContain("play_step");
    });

    it("runs short_fiction_run only after short production is confirmed", () => {
      const prompt = buildAgentSystemPrompt(null, "zh", "short", {
        actionSource: "button",
        requestedIntent: "short_run",
      });
      expect(prompt).toContain("short_fiction_run");
      expect(prompt).not.toContain("generate_cover：");
      expect(prompt).not.toContain("sub_agent");
      expect(prompt).not.toContain("play_start");
    });

    it("runs generate_cover only after cover generation is confirmed", () => {
      const prompt = buildAgentSystemPrompt(null, "zh", "short", {
        actionSource: "button",
        requestedIntent: "generate_cover",
      });
      expect(prompt).toContain("generate_cover");
      expect(prompt).toContain("不重跑正文");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("sub_agent");
      expect(prompt).not.toContain("play_start");
    });

    it("English short mode does not mention book-creation internals before confirmation", () => {
      const prompt = buildAgentSystemPrompt(null, "en", "short");
      expect(prompt).toContain("InkOS Short assistant");
      expect(prompt).toContain("propose_action");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("sub_agent");
      expect(prompt).not.toContain("architect");
    });
  });

  describe("play mode", () => {
    it("gates new world start behind a confirmation proposal but keeps play_step", () => {
      const prompt = buildAgentSystemPrompt(null, "zh", "play");
      expect(prompt).toContain("InkOS Play 助手");
      expect(prompt).toContain("propose_action");
      expect(prompt).toContain("play_start");
      expect(prompt).toContain("play_step");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("generate_cover");
      expect(prompt).not.toContain("sub_agent");
      expect(prompt).not.toContain("architect");
    });

    it("runs play_start only after world start is confirmed", () => {
      const prompt = buildAgentSystemPrompt(null, "zh", "play", {
        actionSource: "button",
        requestedIntent: "play_start",
      });
      expect(prompt).toContain("play_start");
      expect(prompt).not.toContain("play_step");
      expect(prompt).not.toContain("propose_action");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("sub_agent");
    });
  });

  describe("book mode", () => {
    it("contains active-book writing tools and no cross-mode production tools", () => {
      const prompt = buildAgentSystemPrompt("my-book", "zh", "book");
      expect(prompt).toContain("my-book");
      expect(prompt).toContain("sub_agent");
      expect(prompt).toContain("writer");
      expect(prompt).toContain("auditor");
      expect(prompt).toContain("reviser");
      expect(prompt).toContain("chapterWordCount");
      expect(prompt).toContain("chapterNumber");
      expect(prompt).toContain("anti-detect");
      expect(prompt).toContain("approvedOnly");
      expect(prompt).toContain("generate_cover");
      expect(prompt).toContain("read");
      expect(prompt).toContain("write_truth_file");
      expect(prompt).toContain("rename_entity");
      expect(prompt).toContain("patch_chapter_text");
      expect(prompt).toContain("grep");
      expect(prompt).toContain("ls");
      expect(prompt).toContain("outline/story_frame.md");
      expect(prompt).toContain("roles/major/<name>.md");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("play_start");
      expect(prompt).not.toContain("play_step");
      expect(prompt).not.toMatch(/agent="architect"/);
    });

    it("steers chapter rewrite to reviser instead of writer", () => {
      const prompt = buildAgentSystemPrompt("my-book", "zh", "book");
      expect(prompt).toContain("改 / 修订 / 重写第 N 章");
      expect(prompt).toContain("sub_agent(agent=\"reviser\", chapterNumber=N)");
      expect(prompt).toContain("writer 只会续写新的下一章");
      expect(prompt).toContain("不要用 writer");
    });

    it("English active-book prompt is also isolated", () => {
      const prompt = buildAgentSystemPrompt("novel", "en", "book");
      expect(prompt).toContain("working on book \"novel\"");
      expect(prompt).toContain("sub_agent");
      expect(prompt).toContain("generate_cover");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("play_start");
      expect(prompt).not.toMatch(/agent="architect"/);
    });
  });

  describe("edit mode", () => {
    it("contains deterministic edit tools but no production tools", () => {
      const prompt = buildAgentSystemPrompt("my-book", "zh", "edit");
      expect(prompt).toContain("外部编辑助手");
      expect(prompt).toContain("read");
      expect(prompt).toContain("write_truth_file");
      expect(prompt).toContain("rename_entity");
      expect(prompt).toContain("patch_chapter_text");
      expect(prompt).toContain("grep");
      expect(prompt).toContain("ls");
      expect(prompt).not.toContain("sub_agent");
      expect(prompt).not.toContain("generate_cover");
      expect(prompt).not.toContain("short_fiction_run");
      expect(prompt).not.toContain("play_start");
    });
  });

  describe("global output rules", () => {
    it("forbids emoji in Chinese and English prompts", () => {
      expect(buildAgentSystemPrompt(null, "zh", "chat")).toContain("不要使用表情符号");
      expect(buildAgentSystemPrompt(null, "en", "chat")).toContain("Do not use emoji");
    });

    it("forbids claiming side effects without successful tool execution", () => {
      expect(buildAgentSystemPrompt(null, "zh", "chat")).toContain("不要声称已经创建、写入、修改或生成任何文件");
      expect(buildAgentSystemPrompt(null, "en", "chat")).toContain("Do not claim that anything was created");
    });
  });
});
