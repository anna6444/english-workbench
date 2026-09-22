/**
 * 数据备份与恢复服务（模块一 1.2）。
 *
 * 导出：把所有学生的核心数据（单词/文件夹/错题/星星/柯基/进度/作业/提交/考试）
 *       + 共享题库打包成一个 JSON 文件下载。
 * 导入：校验格式后整体覆写对应学生的私有数据 + 题库，页面刷新后生效。
 *
 * 设计原则：
 *   - 账号体系（含密码）不进备份 —— 导出文件可能被分享，不能带敏感信息
 *   - 导入是「覆盖」语义 —— 与规格书一致，恢复 = 回到备份时刻的快照
 *   - 全部走 Repository 接口（seedForStudent/seed），未来换后端零改动
 */

import type { BackupData, StudentBackup } from '@/types';
import type { Repositories } from '@/repositories/types';
import type { Student } from '@/types';

/** 打包全部学生的数据为备份结构 */
export async function buildBackup(
  repos: Repositories,
  students: Student[],
  exportedBy?: string,
): Promise<BackupData> {
  const studentPacks: StudentBackup[] = [];

  for (const stu of students) {
    const sid = stu.id;
    const [
      words,
      folders,
      wrongs,
      reward,
      corgi,
      progress,
      assignments,
      submissions,
      exams,
    ] = await Promise.all([
      repos.vocabulary.listByStudent(sid),
      repos.folder.listByStudent(sid),
      repos.wrongBook.listByStudent(sid),
      repos.reward.get(sid),
      repos.corgi.get(sid),
      repos.progress.get(sid),
      repos.assignment.listByStudent(sid),
      repos.submission.listByStudent(sid),
      repos.examRecord.listByStudent(sid),
    ]);

    studentPacks.push({
      studentId: sid,
      nickname: stu.nickname,
      words,
      folders,
      wrongs,
      reward,
      corgi,
      progress,
      assignments,
      submissions,
      exams,
    });
  }

  const questions = await repos.question.list();

  return {
    format: 'egw-backup',
    version: 1,
    exportedAt: Date.now(),
    exportedBy,
    students: studentPacks,
    questions,
  };
}

/** 触发浏览器下载 JSON 备份文件 */
export function downloadBackup(data: BackupData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  a.href = url;
  a.download = `英语词句生长世界-备份-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 解析并校验 JSON 文本为备份结构（格式不对抛错给 UI 展示） */
export function parseBackupText(text: string): BackupData {
  const data = JSON.parse(text) as BackupData;
  if (data?.format !== 'egw-backup' || !Array.isArray(data.students)) {
    throw new Error('这不是本应用的备份文件（缺少格式标记）');
  }
  return data;
}

/**
 * 导入备份（覆盖语义）：
 *   每个学生包覆写其全部私有域；共享题库整体覆写。
 *   返回统计信息供 UI 展示「恢复了什么」。
 */
export async function importBackup(
  repos: Repositories,
  data: BackupData,
): Promise<{ students: number; words: number; questions: number }> {
  let words = 0;

  for (const pack of data.students) {
    const sid = pack.studentId;
    await repos.vocabulary.seedForStudent(sid, pack.words ?? []);
    await repos.folder.seedForStudent(sid, pack.folders ?? []);
    await repos.wrongBook.seedForStudent(sid, pack.wrongs ?? []);
    if (pack.reward) await repos.reward.seed(sid, pack.reward);
    if (pack.corgi) await repos.corgi.seedForStudent(sid, pack.corgi);
    if (pack.progress) await repos.progress.seed(sid, pack.progress);
    await repos.assignment.seedForStudent(sid, pack.assignments ?? []);
    await repos.submission.seedForStudent(sid, pack.submissions ?? []);
    await repos.examRecord.seedForStudent(sid, pack.exams ?? []);
    words += (pack.words ?? []).length;
  }

  if (Array.isArray(data.questions)) {
    await repos.question.seed(data.questions);
  }

  return { students: data.students.length, words, questions: data.questions?.length ?? 0 };
}
