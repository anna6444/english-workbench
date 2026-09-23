# 「英语词句生长世界」三模块改造 · 交付报告

> 在线地址：**https://a04e7bd2013bb1c5f.app.workbuddy.host**
> 技术栈：Vite + React 18 + TypeScript + TailwindCSS + @react-three/fiber 8 + three 0.169 + drei 9.114 · 纯 localStorage 无后端
> 验证状态：`tsc --noEmit` 零错误 · `vite build` 成功 · Playwright 浏览器冒烟全通过 · 线上已部署并复验

---

## ① 登录与权限漏洞修复 —— 文件清单与方案

**漏洞根因**：旧 `SessionProvider` 只有 guardian（家长）一个登录主体，`RequireSession` 不校验角色，`viewMode` 默认 `student` → 任何人登录后都能看到孩子页面，家长/老师无独立视图。

**修复方案**：三角色一等公民 + 路由层强制分发。

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `src/app/authTypes.ts` | 新建 | 三角色类型单一事实来源（`AuthRole`/`AuthContextValue`） |
| `src/app/AuthProvider.tsx` | 新建（替代 SessionProvider） | 鉴权状态机 + localStorage 持久化 `egw:v1:meta:auth` |
| `src/app/AuthGuard.tsx` | 新建 | 角色路由守卫：未登录→/login，角色不符→`homeOfRole(role)` 弹回 |
| `src/pages/Login/LoginPage.tsx` | 重写 | 四步状态机登录页（三角色卡片 → 各自登录方式） |
| `src/routes/AppRoutes.tsx` | 重写 | 三棵角色路由树（学生/家长/老师互不可见） |
| `src/app/AppShell.tsx` | 重写 | 学生专用布局（删除 viewMode 切换器） |
| `src/app/GuardianShell.tsx` | 新建 | ParentShell（只读）+ TutorShell（管理批改）共用布局 |
| `src/app/StudentSwitcher.tsx` | 重写 | 顶栏切换孩子下拉（接 useAuth） |
| `src/app/nav.ts` | 重写 | 新增「柯基乐园」导航项；删除 GUARDIAN_NAV |
| `src/App.tsx` | 重写 | AuthBootstrap 注入数据加载器 |
| 已删除 | — | `SessionProvider.tsx`、`sessionTypes.ts`、`useViewSync.ts`（10 个学生页面 import 已批量迁移） |

**守卫核心逻辑**：

```tsx
export function homeOfRole(role: AuthRole): string {
  if (role === 'parent') return '/parent';
  if (role === 'tutor') return '/tutor';
  return '/';
}

export function AuthGuard({ allow, children }: { allow: AuthRole[]; children: ReactNode }) {
  const { ready, role } = useAuth();
  if (!ready) return <LoadingState />;
  if (!role) return <Navigate to="/login" replace />;
  if (!allow.includes(role)) return <Navigate to={homeOfRole(role)} replace />; // 弹回本角色首页
  return <>{children}</>;
}
```

**路由分发模式**（三棵树，互不可见）：

```tsx
<Route element={<AuthGuard allow={['student']}><AppShell /></AuthGuard>}>
  <Route index element={<HomePage />} />
  <Route path="/corgi" element={<Suspense fallback={<LoadingState/>}><CorgiPage /></Suspense>} />
  ...
</Route>
<Route element={<AuthGuard allow={['parent']}><ParentShell /></AuthGuard>}>
  <Route path="/parent" element={<ParentViewPage />} />
</Route>
<Route element={<AuthGuard allow={['tutor']}><TutorShell /></AuthGuard>}>
  <Route path="/tutor" element={<TutorViewPage />} />
</Route>
```

**兼容性设计**：`AuthProvider` 保留 `currentStudentId / currentStudent / children / switchStudent` 字段并导出 `useSession` 别名 hook，10 个学生页面仅改 import 路径即完成迁移，学习模块零功能损失。

**登录页（四步状态机）**：`LoginStep = 'role' | 'student' | 'parent' | 'tutor'`
- 角色选择：三张卡片 🧑‍🎓 我是孩子 / 👨‍👩‍👧 我是家长（只读） / 👩‍🏫 我是老师（管理批改）
- 孩子入口：名字模糊匹配（name/nickname includes）或点头像宫格直接进
- 家长/老师入口：账号密码表单，角色不符给出中文提示（演示账号 mama / teacher，密码 1234）

## ② 家长/辅导视图 —— 切换孩子的数据绑定（核心）

**数据联动机制**（家长与老师共用）：`AuthContext.currentStudentId` 是唯一事实来源。

```tsx
// AuthProvider.tsx —— 学生登录取自身，家长/老师取 activeStudentId
const currentStudentId = role === 'student' ? (student?.id ?? null) : activeStudentId;

// StudentSwitcher.tsx —— 下拉切换：改 activeStudentId → 整棵视图树自动重拉
const switchStudent = useCallback(async (sid: ID) => {
  setActiveStudentId(sid);          // 触发所有依赖 currentStudentId 的 useEffect
  setDropdownOpen(false);
}, []);
// 单孩子的家长自动隐藏下拉；切换后图表/进度/星星/错题全部实时联动，绝不空白
```

```tsx
// ParentViewPage.tsx —— 每个数据块都依赖 currentStudentId，切换即重拉 + loading 骨架
useEffect(() => {
  if (!currentStudentId) return;
  setLoading(true);
  void Promise.all([repos.reward.get(currentStudentId), repos.quiz.getSummary(currentStudentId), ...])
    .then(([reward, quiz, ...]) => { setStars(reward.stars); ...; setLoading(false); });
}, [currentStudentId, repos]);
```

- **家长视图**（`/parent`，只读）：统计卡 + 内联 SVG「星星趋势（近 6 周）」折线图 + 错题/成绩 + 页脚 🔒 只读声明（"如需布置作业请使用老师的辅导中心"），**全文无任何布置/批改按钮**
- **老师视图**（`/tutor`，四 Tab）：布置作业（选孩子宫格 → 选作业模板 → 单孩下发）/ 批改（分数+评语，批改 +2⭐）/ 账号绑定（绑定/解绑学生，`refreshChildren` 联动）/ 错题汇总（跟随 currentStudentId）

## ③ 3D 柯基乐园 —— 组件清单与关键实现

| 文件 | 职责 |
| --- | --- |
| `src/features/corgi3d/animCommand.ts` | `AnimCommand{type,nonce}` 单向动画命令流（防渲染环路） |
| `src/features/corgi3d/CorgiScene.tsx` | Canvas 编排：灯光/地面/阴影/气泡 Html/OrbitControls(限角)/FPS 看门狗(<28fps 降级)/WebGL 预探测+双层 ErrorBoundary |
| `src/features/corgi3d/GlbCorgi.tsx` | 方案 A：加载 `/models/corgi.glb`，尺寸归一 + 动画名模糊匹配（CLIP_ALIASES） |
| `src/features/corgi3d/ProceduralCorgi.tsx` | 方案 B：胶囊/球/圆锥 + meshToonMaterial 程序化卡通柯基（呼吸/摇尾/歪头/跳/蹭/坐/握手/转圈 + 瞳孔跟随鼠标 + 头身分区点击 + 饰品挂点） |
| `src/features/corgi3d/HeartParticles.tsx` | 15 心对象池爱心粒子（nonce 驱动爆发） |
| `src/features/corgi3d/useBark.ts` | Web Audio 合成汪汪/开心哼叫（零音频文件） |
| `src/features/corgi3d/perf.ts` | 静态低配设备检测（cores/mem/屏宽） |
| `src/pages/student/CorgiPage.tsx` | 乐园主页：状态栏/3D 舞台/背包/四大按钮/商城弹窗/STT 语音指令/改名 |

**渲染兜底三层**（本次冒烟实测全部命中过）：
1. `public/models/corgi.glb` 存在 → GLB 模型柯基
2. GLB 缺失/加载失败 → ErrorBoundary 自动切程序化柯基（沙箱实测即此模式，效果见截图）
3. 设备无 WebGL（老旧设备）→ 渲染前预探测 `useWebGLSupport()`，直接 2D 大柯基互动模式（喂养/商城/语音全保留，**不崩页**）；另有 FPS<28 运行时看门狗 → 自动开流畅模式并提示

**互动与语音**：
- 点头部 → 跳跃 + 爱心粒子 + 合成汪汪 + 气泡「汪汪！」；点身体 → 蹭蹭 + 童声「好舒服呀～」（Web Speech API，rate 0.9）
- 🎙️ 语音指令：SpeechRecognition（zh-CN）识别「坐下/握手/转圈」→ 触发动画 + 随机鼓励语 + 经验 +2；未命中 → 气泡「「原文」汪？」
- OrbitControls：拖拽旋转（方位角/俯仰角限位，禁平移）；瞳孔实时跟随鼠标

## ④ 养成数值与商城 Repository

| 文件 | 内容 |
| --- | --- |
| `src/types/corgi.ts` | `CorgiState`（饱食/快乐/亲密/等级/经验/背包/永久道具/佩戴/豪华窝）+ `SHOP_ITEMS` 7 件道具 + `xpToNext(level)=40+(level-1)*25`（封顶 10 级） |
| `src/repositories/types.ts` | `CorgiRepository` 接口 + `CorgiActionResult`；`RewardRepository.spendStars` |
| `src/repositories/local/CorgiRepository.ts` | localStorage 实现：离线衰减（每 2h 饱食-1 / 每 1h 快乐-1，封顶 60/40）、feed/play/buy/equip/rename/addXp、`buy` 经 `spendStars` 扣星（不足返回 false 并提示差多少颗） |
| `src/repositories/local/RewardRepository.ts` | `spendStars`：余额不足不动账；消耗不计入 weeklyStars |

**星星经济闭环**（冒烟实测：12⭐ 买 8⭐ 磨牙棒 → 余 4⭐，货架正确变「星星不够」禁用）：
学会单词 +1⭐（justMastered）· 完成单元小测 +5⭐ · 老师批改 +2⭐ ↔ 商城消耗（磨牙棒 8 / 狗粮 10 / 网球 15 / 泡泡 20 / 蝴蝶结 30 / 礼帽 30 / 豪华狗窝 50）

**数据隔离**：柯基按 `studentId` 隔离（key=`egw:v1:s:{sid}:corgi`），每孩固定一只，切换孩子互不影响。

## ⑤ Tailwind 主题配置（整体可爱化）

`tailwind.config.js` —— 策略：**直接覆盖原冷色色阶值，类名不变，全站零页面改动完成暖化**。
- 新命名色板：`cream` 奶油白 / `sakura` 樱花粉 / `butter` 鹅黄 / `mint` 薄荷绿 / `cocoa` 可可棕（文字）
- 冷色重映射：`sky`→薄荷绿、`slate`→暖可可灰、`violet`→珊瑚粉、`emerald/amber` 柔化
- `boxShadow.soft = 0 4px 20px rgba(0,0,0,0.06)`（卡片统一）/ `soft-lg`；按钮 `rounded-2xl/3xl + active:translate-y-0.5` 按压手感
- `index.css`：body 背景 `#fffbf5`、文字 `#4e3f3a`、滚动条暖粉、`theme-color` 改 `#FFD9E2`
- 柯基乐园布局：中央全屏 Canvas + 底部四大按钮 + 顶部等级进度条/星星 + 右侧道具背包（移动端并入商城弹窗）

## ⑥ GLB 模型免费下载与放置路径（可选增强）

把模型命名为 **`corgi.glb`** 放到 **`public/models/corgi.glb`**（重新 build 或直接放 dist/models/）即可自动启用，链接不变：

| 来源 | 授权 | 推荐度 |
| --- | --- | --- |
| https://poly.pizza/search/corgi | CC0 | ⭐⭐⭐ 低多边形卡通风，选带动画的 |
| https://quaternius.com/packs/animatedanimals.html | CC0 | ⭐⭐⭐ 完整动画动物包（含狗），建议 <5MB |
| https://sketchfab.com/search?q=corgi&features=downloadable&licenses=cc | CC 系列 | ⭐⭐ 筛「可下载+CC」，导出 GLB |

**不放也完全不影响**：程序化几何柯基已内置并实测渲染正常（见 `public/models/README.md`）。

## ⑦ 运行方式与验证结论

```bash
cd english-growth-world
pnpm install && npx tsc --noEmit && npx vite build   # 类型零错误，构建通过
npx vite preview --port 4173                          # 本地预览
```

**Playwright 冒烟结论（全部通过，零控制台错误）**：未登录访问任意页→弹回 /login ✓ 三角色登录 ✓ 学生进柯基乐园 ✓ 商城购买扣星闭环 ✓ 家长只读+切换孩子数据联动（86 分钟→24 分钟实时切换）✓ 老师 四 Tab+权限弹回（访问 /parent、/ 自动弹回 /tutor）✓ 3D Canvas 渲染+点击互动（汪汪！）✓ FPS 看门狗自动降级 ✓ 移动端 375×812 无横向滚动、底部 5 Tab、按钮 68px ✓

**已交付截图**：`shot-desktop-home.png`（学生首页）、`shot-desktop-corgi.png`（柯基乐园 2D 兜底）、`shot-3d-corgi.png`（3D 程序化柯基，本地）、`shot-live-3d.png`（线上 3D）。
