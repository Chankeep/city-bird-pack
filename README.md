# 城市飞鸟图鉴

一款以城市飞鸟为主题的抽卡小工具。撕开卡包、翻牌，把屋顶街巷、城市花园和暮色水岸的 36 种鸟收进图鉴。放大卡片后可以拖动观察实时反光、鸟羽纹理和全息效果。

## 本地运行

在项目根目录启动静态服务器。

```sh
python -m http.server 8080
```

打开 [http://localhost:8080](http://localhost:8080)。项目使用原生 HTML、CSS 和 JavaScript，可以从 `index.html` 直接进入，无需构建。

## 项目目录

| 位置 | 内容 |
| --- | --- |
| `index.html` | 页面入口 |
| `scripts/` | 抽卡、图鉴、卡片交互、WebGL 渲染和音效 |
| `styles/` | 页面、卡片与动画样式 |
| `assets/birds/` | 36 种城市飞鸟的插画图集 |
| `assets/masks/` | 鸟身遮罩与鸟羽压印贴图 |
| `assets/packs/` | 三套卡包封面 |
| `assets/textures/` | 金属颗粒、全息散射和光芒贴图 |

## 许可

本项目采用 [MIT License](LICENSE)。
