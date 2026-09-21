/**
 * 应用入口 —— 组装所有 Provider。
 *
 * Provider 顺序（由外到内，下层可依赖上层）：
 *   RepositoriesProvider  ← 数据能力（最底层，谁都能用）
 *     SpeechProvider      ← 语音能力（朗读按钮遍布全站）
 *       AuthProvider      ← 鉴权（需要仓储查询账号/学生）
 *         HashRouter      ← 路由
 */

import { HashRouter } from 'react-router-dom';
import { RepositoriesProvider, useRepositories } from '@/repositories/RepositoriesProvider';
import { SpeechProvider } from '@/services/speech/SpeechProvider';
import { AuthProvider } from '@/app/AuthProvider';
import { AppRoutes } from '@/routes/AppRoutes';
import { attachDebugTools } from '@/mock/seed';
import { useEffect } from 'react';

/** 鉴权需要仓储提供「查学生」「查账号」「查孩子」三个能力 */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const repos = useRepositories();

  useEffect(() => {
    attachDebugTools(repos);
  }, [repos]);

  return (
    <AuthProvider
      loadStudent={(id) => repos.student.get(id)}
      loadGuardian={(id) => repos.parent.get(id)}
      loadChildren={(parentId) => repos.student.listByParent(parentId)}
    >
      {children}
    </AuthProvider>
  );
}

export function App() {
  return (
    <RepositoriesProvider>
      <SpeechProvider>
        <AuthBootstrap>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </AuthBootstrap>
      </SpeechProvider>
    </RepositoriesProvider>
  );
}

export default App;
