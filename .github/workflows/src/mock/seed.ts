/**
 * 播种逻辑 —— 首次运行时把 Mock 数据灌入存储层。
 *
 * 设计要点：
 *   1. 幂等：靠 system.seedVersion 判断，重复调用不会翻倍数据
 *   2. 差异化：6 个学生种入**不同的**单词量/星星/错题/进度。
 *      这点很关键 —— 如果每人一份相同数据，家长切换孩子时
 *      根本看不出「隔离」是否真的生效。数据必须长得不一样。
 *   3. 可重复：时间戳全部固定，清空后重新播种得到一致结果
 */

import type { Repositories } from '../repositories/types';
import type {
  Assignment,
  ID,
  ProgressState,
  RewardState,
  VocabularyWord,
  WrongRecord,
} from '../types';
import { storage } from '../storage/StorageManager';
import { studentKey } from '../storage/keys';
import { MOCK_PARENTS, MOCK_STUDENTS } from './accounts';
import { MOCK_UNITS } from './units';
import { MOCK_QUESTIONS } from './questions';
import { MOCK_EPISODES } from './episodes';
import { MOCK_BOOKS } from './books';
import { MOCK_HOMEWORKS, MOCK_PAPERS } from './homeworks';
import { draftFromOffline, lookupOffline, normalizeWord } from '../services/lookup/offlineDictionary';
import { splitSyllables } from '../services/lookup/syllable';

export interface SeedResult {
  seeded: boolean;
  parents: number;
  students: number;
  units: number;
  questions: number;
  episodes: number;
  books: number;
  homeworks: number;
  papers: number;
  /** 每个学生种入的私有数据量，便于控制台核对隔离效果 */
  perStudent: { studentId: string; words: number; wrongs: number; stars: number }[];
}

/** 每个学生的差异化画像 —— 决定种入多少数据 */
interface Profile {
  wordCount: number;
  unit1Learned: number;
  stars: number;
  wrongCount: number;
  /** 已消灭几道错题（用来演示「已掌握」状态） */
  clearedWrongs: number;
  streakDays: number;
  totalMinutes: number;
}

const PROFILES: Record<string, Profile> = {
  // 远远：学得最扎实，单词多、错题少
  's-1': { wordCount: 16, unit1Learned: 12, stars: 42, wrongCount: 3, clearedWrongs: 1, streakDays: 5, totalMinutes: 86 },
  // 甜甜：一年级，学得少，星星也少
  's-2': { wordCount: 6, unit1Learned: 4, stars: 12, wrongCount: 2, clearedWrongs: 0, streakDays: 2, totalMinutes: 24 },
  // 齐齐：三年级，词汇量大，错题多一些
  's-3': { wordCount: 28, unit1Learned: 18, stars: 67, wrongCount: 6, clearedWrongs: 2, streakDays: 9, totalMinutes: 152 },
  // 满满：中规中矩
  's-4': { wordCount: 11, unit1Learned: 8, stars: 28, wrongCount: 4, clearedWrongs: 1, streakDays: 3, totalMinutes: 55 },
  // 乐乐：刚起步
  's-5': { wordCount: 4, unit1Learned: 2, stars: 8, wrongCount: 1, clearedWrongs: 0, streakDays: 1, totalMinutes: 15 },
  // 涵涵：单词多且错题也多，正好演示错题本
  's-6': { wordCount: 22, unit1Learned: 15, stars: 51, wrongCount: 7, clearedWrongs: 2, streakDays: 6, totalMinutes: 118 },
};

/** 生成 id（与仓储层保持一致的策略） */
function mkId(seed: number): string {
  return `seed-${seed.toString(36)}`;
}

/** "2026-09-16" */
function dateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** ISO 周键，如 "2026-W37" */
function weekKeyOf(d: Date): string {
  const t = new Date(d.valueOf());
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const firstThursday = new Date(t.getFullYear(), 0, 4);
  firstThursday.setDate(
    firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7),
  );
  const week =
    1 + Math.round((t.valueOf() - firstThursday.valueOf()) / 604800000);
  return `${t.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** 由一个单词生成完整词条（走离线词库，保证有音标/翻译/例句） */
function buildWord(
  studentId: ID,
  word: string,
  unitId: ID,
  idx: number,
  now: number,
): VocabularyWord {
  const norm = normalizeWord(word);
  const entry = lookupOffline(norm);
  const base = entry
    ? draftFromOffline(entry)
    : {
        word: norm,
        translation: '暂无翻译',
        phonetic: '/—/',
        syllables: splitSyllables(norm),
        pos: undefined,
        exampleEn: undefined,
        exampleZh: undefined,
        imageEmoji: '📘',
        lookupStatus: 'partial' as const,
        lookupSource: 'offline' as const,
      };

  return {
    id: mkId(idx + 1),
    studentId,
    word: norm,
    translation: base.translation,
    phonetic: base.phonetic,
    syllables: base.syllables,
    pos: base.pos,
    exampleEn: base.exampleEn,
    exampleZh: base.exampleZh,
    imageEmoji: base.imageEmoji,
    unitId,
    lookupStatus: entry ? 'offline' : 'partial',
    lookupSource: 'offline',
    isMastered: false,
    practiceCount: 0,
    correctCount: 0,
    correctStreak: 0,
    createdAt: now + idx * 10,
    updatedAt: now + idx * 10,
  };
}

/**
 * 执行播种。
 * 若已播种且未指定 force，直接返回 seeded:false。
 */
export async function seedIfNeeded(
  repos: Repositories,
  opts: { force?: boolean } = {},
): Promise<SeedResult> {
  const already = await repos.system.isSeeded();
  if (already && !opts.force) {
    return {
      seeded: false,
      parents: 0, students: 0, units: 0, questions: 0,
      episodes: 0, books: 0, homeworks: 0, papers: 0,
      perStudent: [],
    };
  }

  if (opts.force) {
    await repos.system.resetAll();
  }

  /* ── 1. 共享内容 ── */
  await repos.parent.seed(MOCK_PARENTS);
  await repos.student.seed(MOCK_STUDENTS);
  await repos.unit.seed(MOCK_UNITS);
  await repos.question.seed(MOCK_QUESTIONS);
  await repos.listening.seed(MOCK_EPISODES);
  await repos.reading.seed(MOCK_BOOKS);
  await repos.homework.seed(MOCK_HOMEWORKS);
  await repos.paper.seed(MOCK_PAPERS);

  const now = Date.now();
  const nowDate = dateStr(new Date());
  const wk = weekKeyOf(new Date());
  const unit1 = MOCK_UNITS[0];
  const unit2 = MOCK_UNITS[1];
  const perStudent: SeedResult['perStudent'] = [];

  /* ── 2. 每个学生的私有数据 ── */
  let seedCursor = 1000;

  for (let si = 0; si < MOCK_STUDENTS.length; si++) {
    const stu = MOCK_STUDENTS[si];
    const p = PROFILES[stu.id];
    if (!p) continue;

    /* 单词库 */
    const pool = [...unit1.coreWords, ...unit2.coreWords];
    const picked = pool.slice(0, p.wordCount);
    const words: VocabularyWord[] = picked.map((w, i) => {
      const unitId = unit1.coreWords.includes(w) ? unit1.id : unit2.id;
      // 前 30% 的词设为已掌握（连续答对 3 次）
      const mastered = i < Math.floor(picked.length * 0.3);
      const word = buildWord(stu.id, w, unitId, seedCursor + i, now);
      seedCursor += 1;
      if (mastered) {
        word.isMastered = true;
        word.practiceCount = 3;
        word.correctCount = 3;
        word.correctStreak = 3;
      } else if (i % 3 === 1) {
        // 一部分词练习过但未掌握，让「练习中」状态也有样本
        word.practiceCount = i % 2 === 0 ? 2 : 1;
        word.correctCount = 1;
        word.correctStreak = 1;
      }
      return word;
    });
    await repos.vocabulary.seedForStudent(stu.id, words);

    /* 错题本 */
    const wrongSeeds = MOCK_QUESTIONS.slice(0, p.wrongCount);
    const wrongs: WrongRecord[] = wrongSeeds.map((q, i) => {
      const cleared = i < p.clearedWrongs;
      return {
        id: mkId(seedCursor + i + 5000),
        studentId: stu.id,
        questionId: q.id,
        wrongCount: cleared ? 1 : (i % 3) + 1,
        correctStreak: cleared ? 2 : 0,
        isMastered: cleared,
        lastWrongAt: now - (i + 1) * 3600_000,
        lastPracticedAt: cleared ? now - i * 1800_000 : undefined,
        snapshot: {
          type: q.type,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          emoji: q.image?.emoji,
          audioText: q.audioText,
          passage: q.passage,
        },
        createdAt: now - (i + 1) * 3600_000,
        updatedAt: now - (i + 1) * 3600_000,
      } satisfies WrongRecord;
    });
    seedCursor += wrongSeeds.length + 10;
    await repos.wrongBook.seedForStudent(stu.id, wrongs);

    /* 学习进度 */
    const u2Learned = Math.max(0, p.wordCount - unit1.coreWords.length);
    const progress: ProgressState = {
      studentId: stu.id,
      totalMinutes: p.totalMinutes,
      totalDays: p.streakDays,
      streakDays: p.streakDays,
      lastStudyDate: nowDate,
      units: {
        [unit1.id]: {
          unitId: unit1.id,
          learnedWords: unit1.coreWords.slice(0, p.unit1Learned),
          percent: Math.round((p.unit1Learned / unit1.coreWords.length) * 100),
        },
        [unit2.id]: {
          unitId: unit2.id,
          learnedWords: unit2.coreWords.slice(0, u2Learned),
          percent: Math.round((u2Learned / unit2.coreWords.length) * 100),
        },
      },
      modules: {
        home: { visits: 12, minutes: Math.round(p.totalMinutes * 0.1), lastVisitAt: now },
        unit: { visits: Math.max(1, si + 2), minutes: Math.round(p.totalMinutes * 0.15) },
        vocabulary: { visits: 8, minutes: Math.round(p.totalMinutes * 0.4), lastVisitAt: now },
        listening: { visits: 5, minutes: Math.round(p.totalMinutes * 0.15) },
        reading: { visits: 4, minutes: Math.round(p.totalMinutes * 0.2) },
      },
      completedLessons: Math.floor(p.wordCount / 5),
      updatedAt: now,
    };
    await repos.progress.seed(stu.id, progress);

    /* 奖励（v2：dailyStars 防沉迷记账 + 自定义奖品商城示例） */
    const badged: RewardState['badges'] = [];
    if (p.wordCount >= 1) badged.push({ id: 'first-word', name: '第一步', desc: '添加第一个单词', emoji: '🌱', earnedAt: now - 86400000 * p.streakDays });
    if (p.wordCount >= 10) badged.push({ id: 'word-10', name: '小树苗', desc: '单词库满 10 个词', emoji: '🌿', earnedAt: now - 86400000 * 3 });
    if (p.streakDays >= 3) badged.push({ id: 'streak-3', name: '坚持三天', desc: '连续学习 3 天', emoji: '🔥', earnedAt: now - 86400000 * 2 });
    if (p.clearedWrongs >= 1) badged.push({ id: 'wrong-clear', name: '错题清道夫', desc: '消灭 5 道错题', emoji: '🧹', earnedAt: now - 86400000 });

    const reward: RewardState = {
      studentId: stu.id,
      stars: p.stars,
      coins: Math.floor(p.stars / 3),
      badges: badged,
      weeklyStars: { [wk]: Math.min(p.stars, 20) },
      dailyStars: { [nowDate]: Math.min(p.stars, 12) },
      adjustments: [],
      customShop: [
        {
          id: mkId(seedCursor + 20000),
          name: '看一集动画片',
          emoji: '📺',
          cost: 20,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: mkId(seedCursor + 20001),
          name: '周末去一次游乐园',
          emoji: '🎡',
          cost: 80,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      redeemed: [],
      updatedAt: now,
    };
    await repos.reward.seed(stu.id, reward);
    seedCursor += 10;

    /* 柯基（v2 持续喂养）：s-1 种一只带任务进度的柯基做演示，其余懒创建 */
    if (stu.id === 's-1') {
      const corgiState = {
        studentId: stu.id,
        name: '糯米',
        satiety: 58,
        happiness: 66,
        intimacy: 24,
        level: 3,
        xp: 20,
        inventory: { bone: 1, food: 2 },
        ownedPermanent: ['bow'],
        equippedAccessory: 'bow',
        hasLuxuryNest: false,
        dailyMission: { date: nowDate, wordsDone: 2, settled: false },
        diary: [
          {
            id: mkId(seedCursor + 21000),
            date: nowDate,
            mood: '😊',
            text: '今天和小主人学了 2 个新单词，还差一点点就完成每日任务啦！',
            createdAt: now - 3600_000,
          },
        ],
        learnedWordCount: 16,
        maxLevelBoosted: false,
        weeklyWords: {},
        monthlyWords: {},
        claimedChallenges: [],
        lastTick: now,
        createdAt: now - 86400_000 * 30,
      } satisfies import('../types').CorgiState;
      storage.set(studentKey(stu.id, 'corgi'), corgiState);
    }

    /* 作业派发：轮换，保证两份作业都有人收到 */
    const hw = si % 2 === 0 ? MOCK_HOMEWORKS[0] : MOCK_HOMEWORKS[1];
    const assignment: Assignment = {
      id: mkId(seedCursor + 9000),
      studentId: stu.id,
      homeworkId: hw.id,
      homeworkTitle: hw.title,
      homeworkType: hw.type,
      assignedBy: stu.parentId,
      assignedAt: now - 86400000,
      dueAt: now + hw.dueInDays * 86400000,
      status: 'assigned',
      createdAt: now - 86400000,
      updatedAt: now - 86400000,
    };
    seedCursor += 10;
    await repos.assignment.seedForStudent(stu.id, [assignment]);

    perStudent.push({
      studentId: stu.id,
      words: words.length,
      wrongs: wrongs.length,
      stars: p.stars,
    });
  }

  await repos.system.markSeeded();

  return {
    seeded: true,
    parents: MOCK_PARENTS.length,
    students: MOCK_STUDENTS.length,
    units: MOCK_UNITS.length,
    questions: MOCK_QUESTIONS.length,
    episodes: MOCK_EPISODES.length,
    books: MOCK_BOOKS.length,
    homeworks: MOCK_HOMEWORKS.length,
    papers: MOCK_PAPERS.length,
    perStudent,
  };
}

/** 开发调试用：清空全部数据并重新播种 */
export async function reseed(repos: Repositories): Promise<SeedResult> {
  return seedIfNeeded(repos, { force: true });
}

/** 统计某学生各私有域的数据量 —— 用来验证「切换孩子数据确实隔离」 */
export async function inspectStudent(
  repos: Repositories,
  studentId: ID,
): Promise<{
  words: number;
  wrongs: number;
  masteredWrongs: number;
  stars: number;
  assignments: number;
  totalMinutes: number;
}> {
  const [words, wrongs, mastered, reward, assignments, progress] = await Promise.all([
    repos.vocabulary.countByStudent(studentId),
    (await repos.wrongBook.listActive(studentId)).length,
    repos.wrongBook.countMastered(studentId),
    repos.reward.get(studentId),
    repos.assignment.listByStudent(studentId),
    repos.progress.get(studentId),
  ]);
  return {
    words,
    wrongs,
    masteredWrongs: mastered,
    stars: reward.stars,
    assignments: assignments.length,
    totalMinutes: progress.totalMinutes,
  };
}

/** 便于在浏览器控制台直接调用调试 */
export function attachDebugTools(repos: Repositories): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>).__egw = {
    repos,
    seed: () => seedIfNeeded(repos, { force: true }),
    inspect: (sid: string) => inspectStudent(repos, sid),
    keys: () => storage.allKeys(),
    reset: () => repos.system.resetAll(),
  };
}
