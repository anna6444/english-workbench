import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { createRepositories, type Repositories } from './index';

const RepositoriesContext = createContext<Repositories | null>(null);

export function RepositoriesProvider({ children }: PropsWithChildren) {
  // 全局只创建一次，避免每次渲染都 new 一批仓储实例
  const value = useMemo(() => createRepositories('local'), []);
  return <RepositoriesContext.Provider value={value}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories(): Repositories {
  const ctx = useContext(RepositoriesContext);
  if (!ctx) {
    throw new Error('useRepositories 必须在 <RepositoriesProvider> 内部使用');
  }
  return ctx;
}
