/** 404 —— 迷路了 */

import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState } from '@/components/ui';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Card>
      <EmptyState
        emoji="🧭"
        title="这个页面走丢了"
        desc="它可能被移动或删除了，回首页继续学习吧。"
        action={
          <Button tone="sky" size="md" icon="home" onClick={() => navigate('/')}>
            回到首页
          </Button>
        }
      />
    </Card>
  );
}

export default NotFoundPage;
