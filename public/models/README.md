# 3D 柯基模型（可选增强）

把下载的 GLB 模型命名为 `corgi.glb` 放在本目录即可自动启用：

```
public/models/corgi.glb
```

## 免费模型下载源（任选其一）

| 站点 | 授权 | 说明 |
| --- | --- | --- |
| [Poly Pizza](https://poly.pizza/search/corgi) | CC0 | 搜索 "corgi"，低多边形卡通风，选带动画的最好 |
| [Quaternius · Animated Animals](https://quaternius.com/packs/animatedanimals.html) | CC0 | 完整动画动物包（含狗），推荐导出 GLB |
| [Sketchfab](https://sketchfab.com/search?q=corgi&features=downloadable&licenses=cc) | CC 系列 | 筛选「可下载 + CC 授权」的 corgi 模型，下载 GLB 格式 |

## 说明

- **不放文件也完全不影响使用**：程序内置了程序化几何体柯基（`src/features/corgi3d/ProceduralCorgi.tsx`，胶囊+球+圆锥组合的卡通柯基，带待机呼吸/摇尾/歪头、跳跃、蹭蹭、坐下、握手、转圈全套动画），GLB 缺失或加载失败时自动兜底。
- 放置 GLB 后会自动做三件事：尺寸归一化（缩放到约 1.4 单位高、底面贴地）、动画名模糊匹配（idle/jump/sit/shake/spin/nuzzle 的常见命名都能命中）、头顶点击区兜底。
- 建议选 **< 5MB** 的低多边形模型，儿童设备加载更快。
