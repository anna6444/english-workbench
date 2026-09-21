import type {
  Assignment,
  BaseEntity,
  CorgiState,
  CreateInput,
  ExamPaper,
  ExamRecord,
  Homework,
  ID,
  ListeningEpisode,
  LearningUnit,
  Parent,
  PictureBook,
  ProgressState,
  Question,
  RewardShopItem,
  RewardState,
  Student,
  Submission,
  SystemSettings,
  VocabFolder,
  VocabularyWord,
  WeekKey,
  WrongRecord,
} from '@/types';

/**
 * Repository 接口层 —— 未来换成真实 API 时，页面代码零改动的关键。
 *
 * 核心决策：**所有方法一律返回 Promise**，即便当前 localStorage 实现是同步的。
 * 这样未来把实现换成 fetch 时，调用方一行都不用改。
 */

/** 通用 CRUD */
export interface CrudRepository<T extends BaseEntity> {
  list(): Promise<T[]>;
  get(id: ID): Promise<T | null>;
  create(input: CreateInput<T>): Promise<T>;
  update(id: ID, patch: Partial<T>): Promise<T>;
  remove(id: ID): Promise<void>;
}

/**
 * 学生私有仓储。
 * 注意：故意不继承 CrudRepository 的 list()/get() —— 学生私有数据
 * 必须显式带 studentId，不存在「列出全部学生数据」这种用法。
 */
export interface StudentScopedRepository<T extends BaseEntity> {
  listByStudent(studentId: ID): Promise<T[]>;
  getForStudent(studentId: ID, id: ID): Promise<T | null>;
  create(input: CreateInput<T>): Promise<T>;
  updateForStudent(studentId: ID, id: ID, patch: Partial<T>): Promise<T>;
  removeForStudent(studentId: ID, id: ID): Promise<void>;
  removeAllForStudent(studentId: ID): Promise<void>;
}

// ─────────────── 各实体仓储 ───────────────

export interface ParentRepository extends CrudRepository<Parent> {
  /** 登录校验 */
  findByAccount(account: string, password: string): Promise<Parent | null>;
  /** 种子初始化：整体覆写（仅播种逻辑调用） */
  seed(items: Parent[]): Promise<void>;
}

export interface StudentRepository extends CrudRepository<Student> {
  listByParent(parentId: ID): Promise<Student[]>;
  /** 种子初始化：整体覆写（仅播种逻辑调用） */
  seed(items: Student[]): Promise<void>;
}

export interface UnitRepository extends CrudRepository<LearningUnit> {
  listOrdered(): Promise<LearningUnit[]>;
  seed(items: LearningUnit[]): Promise<void>;
}

export interface VocabularyRepository extends StudentScopedRepository<VocabularyWord> {
  /** 批量添加（查词完成后一次性入库） */
  addBatch(
    studentId: ID,
    words: Omit<VocabularyWord, 'id' | 'createdAt' | 'updatedAt' | 'studentId'>[],
  ): Promise<VocabularyWord[]>;
  findByWord(studentId: ID, word: string): Promise<VocabularyWord | null>;
  listByUnit(studentId: ID, unitId: ID): Promise<VocabularyWord[]>;
  /** 列出某文件夹内的单词（folderId=null 表示根目录散词） */
  listByFolder(studentId: ID, folderId: ID | null): Promise<VocabularyWord[]>;
  /** 移动单词到文件夹（folderId=null 移回根目录） */
  moveToFolder(studentId: ID, wordId: ID, folderId: ID | null): Promise<VocabularyWord>;
  setMastered(studentId: ID, wordId: ID, mastered: boolean): Promise<void>;
  countByStudent(studentId: ID): Promise<number>;
  /** 记录一次练习结果，返回是否已达成掌握 */
  recordPractice(
    studentId: ID,
    wordId: ID,
    isCorrect: boolean,
  ): Promise<{ word: VocabularyWord; justMastered: boolean }>;
  /** 种子初始化：整体覆写（仅播种逻辑调用） */
  seedForStudent(studentId: ID, words: VocabularyWord[]): Promise<void>;
}

/**
 * 学生私有：单词文件夹仓储（多级文件夹管理）。
 * 删除文件夹时做级联处理：内部单词上移一级，子文件夹上移一级（不丢数据）。
 */
export interface VocabFolderRepository extends StudentScopedRepository<VocabFolder> {
  /** 列出某层级的文件夹（parentFolderId=null 为顶层） */
  listByParent(studentId: ID, parentFolderId: ID | null): Promise<VocabFolder[]>;
  /** 新建文件夹 */
  createFolder(
    studentId: ID,
    input: { name: string; emoji?: string; parentFolderId?: ID | null },
  ): Promise<VocabFolder>;
  /** 重命名（或改 emoji，patch 传入） */
  updateFolder(
    studentId: ID,
    folderId: ID,
    patch: Partial<Pick<VocabFolder, 'name' | 'emoji'>>,
  ): Promise<VocabFolder>;
  /**
   * 删除文件夹（不删单词）：内部单词与子文件夹全部上移到被删文件夹的父级。
   */
  removeFolder(studentId: ID, folderId: ID): Promise<void>;
  /** 种子初始化：整体覆写（仅播种逻辑调用） */
  seedForStudent(studentId: ID, folders: VocabFolder[]): Promise<void>;
}

export interface QuestionRepository extends CrudRepository<Question> {
  listByUnit(unitId: ID): Promise<Question[]>;
  /** 随机抽题（组卷 / 闯关用） */
  random(n: number, filter?: { type?: Question['type']; unitId?: ID }): Promise<Question[]>;
  /** 批量导入（老师粘贴文本解析后调用），返回实际新增的题目 */
  addBatch(items: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Question[]>;
  seed(items: Question[]): Promise<void>;
}

export interface ListeningRepository extends CrudRepository<ListeningEpisode> {
  listOrdered(): Promise<ListeningEpisode[]>;
  seed(items: ListeningEpisode[]): Promise<void>;
}

export interface ReadingRepository extends CrudRepository<PictureBook> {
  listOrdered(): Promise<PictureBook[]>;
  seed(items: PictureBook[]): Promise<void>;
}

export interface HomeworkRepository extends CrudRepository<Homework> {
  seed(items: Homework[]): Promise<void>;
}

export interface PaperRepository extends CrudRepository<ExamPaper> {
  listOrdered(): Promise<ExamPaper[]>;
  seed(items: ExamPaper[]): Promise<void>;
}

export interface AssignmentRepository extends StudentScopedRepository<Assignment> {
  /** 给学生派发作业 */
  assign(
    studentId: ID,
    homework: Homework,
    assignedBy: ID,
  ): Promise<Assignment>;
  listByStatus(studentId: ID, status: Assignment['status']): Promise<Assignment[]>;
  /** 种子初始化：整体覆写（仅播种逻辑调用） */
  seedForStudent(studentId: ID, items: Assignment[]): Promise<void>;
}

export interface SubmissionRepository extends StudentScopedRepository<Submission> {
  /** 学生提交 */
  submit(studentId: ID, assignmentId: ID, content: string): Promise<Submission>;
  /** 辅导视图人工批改 */
  grade(
    studentId: ID,
    submissionId: ID,
    score: number,
    comment: string,
    gradedBy: ID,
  ): Promise<Submission>;
  listByAssignment(studentId: ID, assignmentId: ID): Promise<Submission | null>;
  /** 备份恢复：整体覆写（仅导入逻辑使用） */
  seedForStudent(studentId: ID, items: Submission[]): Promise<void>;
}

export interface ExamRecordRepository extends StudentScopedRepository<ExamRecord> {
  saveRecord(
    studentId: ID,
    record: Omit<ExamRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ExamRecord>;
  listRecent(studentId: ID, limit: number): Promise<ExamRecord[]>;
  /** 备份恢复：整体覆写（仅导入逻辑使用） */
  seedForStudent(studentId: ID, items: ExamRecord[]): Promise<void>;
}

export interface WrongBookRepository extends StudentScopedRepository<WrongRecord> {
  /** 答错：写入或累加错题 */
  addWrong(studentId: ID, question: Question): Promise<WrongRecord>;
  /** 答对：连续答对 +1，达到阈值自动标记已掌握 */
  recordCorrect(
    studentId: ID,
    questionId: ID,
  ): Promise<{ record: WrongRecord | null; justMastered: boolean }>;
  listActive(studentId: ID): Promise<WrongRecord[]>;
  listMastered(studentId: ID): Promise<WrongRecord[]>;
  countMastered(studentId: ID): Promise<number>;
  /** 种子初始化：整体覆写（仅播种逻辑调用） */
  seedForStudent(studentId: ID, records: WrongRecord[]): Promise<void>;
}

export interface ProgressRepository {
  get(studentId: ID): Promise<ProgressState>;
  patch(studentId: ID, patch: Partial<ProgressState>): Promise<ProgressState>;
  /** 加学习时长并维护连续打卡天数 */
  addStudyMinutes(studentId: ID, minutes: number): Promise<ProgressState>;
  /** 标记单词已学会；totalWords 为该单元总词数，用于算百分比 */
  markWordLearned(
    studentId: ID,
    unitId: ID,
    word: string,
    totalWords: number,
  ): Promise<ProgressState>;
  /** 记录一次模块访问 */
  touchModule(studentId: ID, moduleId: string): Promise<ProgressState>;
  /** 种子初始化：整体覆写（仅播种逻辑调用） */
  seed(studentId: ID, state: ProgressState): Promise<void>;
}

export interface RewardRepository {
  get(studentId: ID): Promise<RewardState>;
  /**
   * 学习获得星星（防沉迷：每日上限 DAILY_STAR_CAP，超出部分不再发放，
   * 但 weeklyStars 照常累计到上限为止）。调用方无需关心上限细节。
   */
  addStars(studentId: ID, n: number): Promise<RewardState>;
  addCoins(studentId: ID, n: number): Promise<RewardState>;
  /** 消耗星星（柯基商城购买等）。余额不足返回 false，不动账。 */
  spendStars(studentId: ID, n: number): Promise<boolean>;
  /** 尝试授予徽章，返回新获得的徽章（已获得则返回 null） */
  tryAwardBadge(studentId: ID, badgeId: string): Promise<RewardState | null>;
  weeklyStars(studentId: ID, weekKey: WeekKey): Promise<number>;

  /* ── 家长/老师控制台：手动调整（不受每日上限，必附理由） ── */
  adjustStars(
    studentId: ID,
    delta: number,
    reason: string,
    adjustedBy: string,
  ): Promise<RewardState>;

  /**
   * 发放奖励性星星（周/月挑战礼包等）：不受每日防沉迷上限、不计 dailyStars，
   * 但计入 weeklyStars 与调整记录（来源透明可查）。
   */
  grantBonusStars(studentId: ID, n: number, reason: string): Promise<RewardState>;

  /* ── 家长自定义奖品商城（现实奖励） ── */
  addShopItem(
    studentId: ID,
    input: { name: string; emoji: string; cost: number },
  ): Promise<RewardShopItem>;
  updateShopItem(
    studentId: ID,
    itemId: ID,
    patch: Partial<Pick<RewardShopItem, 'name' | 'emoji' | 'cost' | 'enabled'>>,
  ): Promise<RewardShopItem>;
  removeShopItem(studentId: ID, itemId: ID): Promise<void>;
  /** 孩子兑换奖品：扣星 + 写入兑换记录（待家长兑现） */
  redeem(
    studentId: ID,
    itemId: ID,
  ): Promise<{ ok: boolean; reason?: string }>;
  /** 家长标记兑换已兑现 */
  fulfillRedeem(studentId: ID, recordId: ID): Promise<void>;

  /** 种子初始化：整体覆写（仅播种逻辑调用） */
  seed(studentId: ID, state: RewardState): Promise<void>;
}

/**
 * 柯基养成仓储（每个学生固定一只柯基，按 studentId 隔离）。
 * 所有写操作都会同步维护经验/等级，并做属性上下限裁剪。
 *
 * v2 持续喂养扩展：每日任务 / 周月挑战 / 日记 / 升级双条件 / 成长道具门槛。
 */
export interface CorgiRepository {
  /** 读取柯基（不存在时自动创建默认柯基；含离线衰减 + 每日任务跨天结算） */
  get(studentId: ID): Promise<CorgiState>;
  rename(studentId: ID, name: string): Promise<CorgiState>;
  /** 喂食：消耗背包食物 → 饱食度上升 */
  feed(studentId: ID, foodId: string): Promise<CorgiActionResult>;
  /** 玩耍：消耗玩具；toyId='pet' 为免费抚摸 */
  play(studentId: ID, toyId: string): Promise<CorgiActionResult>;
  /** 商城购买：扣星星 + 入背包/永久解锁（含等级门槛校验） */
  buy(studentId: ID, itemId: string): Promise<CorgiActionResult>;
  /** 佩戴/摘下饰品（bow/hat/cape，传 null 摘下） */
  equip(studentId: ID, itemId: string | null): Promise<CorgiState>;
  /**
   * 加经验（升级自动处理）。
   * v2：升级需双条件 —— 经验达标 && 累计学习单词数达标（防沉迷）。
   */
  addXp(studentId: ID, amount: number): Promise<CorgiState>;

  /* ── 持续喂养：每日任务（5 词 + 10 星 → 属性回满） ── */

  /**
   * 记录「学会一个单词」：每日任务词数 +1、周/月挑战词数记账、
   * 累计学习单词数 +1；若任务刚好达成（词数达标 && 今日星星达标）自动结算回满。
   */
  recordLearnedWord(studentId: ID): Promise<CorgiState>;
  /**
   * 检查每日任务是否达成（星星达标时机调用，如小测 +5 星后）。
   * 达成且未结算 → 饱食/快乐回满 + 写日记。幂等，可放心重复调用。
   */
  checkMission(studentId: ID): Promise<CorgiState>;
  /** 孩子给柯基写一句贴心话（柯基日记，孩子视角） */
  addDiary(studentId: ID, mood: string, text: string): Promise<CorgiState>;

  /** 备份恢复：整体覆写柯基状态（仅导入逻辑使用） */
  seedForStudent(studentId: ID, state: CorgiState): Promise<void>;

  /* ── 持续喂养：周期挑战 ── */

  /** 领取周挑战豪华大礼包（本周学会 ≥30 词），重复领取返回 ok:false */
  claimWeeklyGift(studentId: ID): Promise<CorgiActionResult>;
  /** 领取月挑战（本月学会 ≥100 词）：等级上限 10→15 + 新形态，一次性 */
  claimMonthlyChallenge(studentId: ID): Promise<CorgiActionResult>;

  /**
   * 免费发放永久道具（连续打卡解锁等系统奖励，不扣星星）。
   * source 写入日记，如「连续学习 7 天奖励」。已拥有返回 ok:false。
   */
  grantFreeItem(studentId: ID, itemId: string, source: string): Promise<CorgiActionResult>;
}

/** 柯基动作结果：ok=false 时 reason 给孩子能看懂的提示 */
export interface CorgiActionResult {
  ok: boolean;
  reason?: string;
  state: CorgiState;
  /** 本次动作升了几级（用于升级庆祝） */
  levelUp: number;
}

/**
 * 系统元信息仓储 —— 横切关注点，不属于任何业务实体。
 * 负责种子标记、全局重置、存储用量统计。
 */
export interface SystemRepository {
  getMeta(): Promise<{ seedVersion: number; seededAt?: number; lastOpenedAt?: number }>;
  isSeeded(): Promise<boolean>;
  markSeeded(): Promise<void>;
  clearSeedFlag(): Promise<void>;
  /** 清空所有应用数据，回到初始状态 */
  resetAll(): Promise<void>;
  stats(): Promise<{ key: string; bytes: number }[]>;
  totalBytes(): Promise<number>;
}

/**
 * 全局设置仓储 —— 家长可改、学生端只读生效的性能/体验开关。
 * （如「强制 2D 模式」：老旧设备跳过 3D 渲染）
 */
export interface SettingsRepository {
  getSettings(): Promise<SystemSettings>;
  updateSettings(patch: Partial<SystemSettings>): Promise<SystemSettings>;
}

/** 所有仓储的集合，通过 Context 注入 */
export interface Repositories {
  parent: ParentRepository;
  student: StudentRepository;
  unit: UnitRepository;
  vocabulary: VocabularyRepository;
  /** 单词文件夹（多级管理） */
  folder: VocabFolderRepository;
  question: QuestionRepository;
  listening: ListeningRepository;
  reading: ReadingRepository;
  homework: HomeworkRepository;
  paper: PaperRepository;
  assignment: AssignmentRepository;
  submission: SubmissionRepository;
  examRecord: ExamRecordRepository;
  wrongBook: WrongBookRepository;
  progress: ProgressRepository;
  reward: RewardRepository;
  /** 3D 柯基养成（每生一只，隔离存储） */
  corgi: CorgiRepository;
  /** 系统元信息（种子标记 / 重置 / 存储统计） */
  system: SystemRepository;
  /** 全局设置（强制 2D 等） */
  settings: SettingsRepository;
}
