/**
 * 学生切换器 —— 家长/老师端的「换孩子」控件。
 *
 * 这是数据隔离能被家长直观感知的唯一入口。
 * 切换后通过 AuthContext 广播 activeStudentId，
 * 家长视图/辅导视图的所有数据（进度、错题、星星、图表）重新按新 studentId 拉取。
 *
 * 注意：学生端不用这个组件 —— 学生只能是自己（AuthGuard 保证）。
 */

import { useEffect, useRef, useState } from 'react';
import type { Student } from '@/types';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/app/AuthProvider';

export function StudentSwitcher({ label = '正在查看' }: { label?: string }) {
  const { children, currentStudent, switchStudent } = useAuth();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /* 点击外部关闭 */
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!currentStudent || children.length === 0) return null;

  /* 只有一个孩子时不显示切换器，减少干扰 */
  const single = children.length === 1;

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => !single && setOpen((v) => !v)}
        className={`flex items-center gap-3 rounded-2xl bg-white border-2 border-sakura-100 px-3.5 py-2.5 transition-colors ${
          single ? 'cursor-default' : 'hover:border-sakura-300 hover:bg-sakura-50'
        }`}
        aria-haspopup={!single}
        aria-expanded={open}
      >
        <span className="text-2xl leading-none select-none">{currentStudent.avatar}</span>
        <span className="text-left leading-tight hidden sm:block">
          <span className="block text-xs text-cocoa-400 font-semibold">{label}</span>
          <span className="block text-sm font-extrabold text-cocoa-700">
            {currentStudent.nickname}
          </span>
        </span>
        {!single && <Icon name="arrowRight" size={16} className="text-cocoa-400 rotate-90" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-3xl bg-white border-2 border-sakura-100 shadow-soft-lg p-2 z-50 animate-[pop-in_0.16s_ease-out]">
          <p className="px-3 py-2 text-xs font-bold text-cocoa-400">切换孩子（数据互相独立）</p>
          {children.map((s) => (
            <ChildRow
              key={s.id}
              student={s}
              active={s.id === currentStudent.id}
              onPick={() => {
                switchStudent(s.id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildRow({
  student,
  active,
  onPick,
}: {
  student: Student;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors min-h-[56px] ${
        active
          ? 'bg-sakura-50 border-2 border-sakura-200'
          : 'hover:bg-sakura-50 border-2 border-transparent'
      }`}
    >
      <span className="text-2xl leading-none select-none">{student.avatar}</span>
      <span className="flex-1 leading-tight">
        <span className="block text-sm font-extrabold text-cocoa-700">{student.nickname}</span>
        <span className="block text-xs text-cocoa-400 font-semibold">
          {student.grade} 年级 · {student.className ?? '未分班'}
        </span>
      </span>
      {active && <Icon name="check" size={18} className="text-sakura-500" />}
    </button>
  );
}
