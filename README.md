# Sora2 AI 视频生成应用

这是一个基于 Next.js 和 Tailwind CSS 构建的 Sora2 AI 视频生成单页应用，支持文生视频和图生视频功能。

## 功能特性

- 🎬 **文生视频**: 通过文本描述生成视频
- 🖼️ **图生视频**: 上传图片并结合文本描述生成视频
- 🎨 **全屏背景视频**: 沉浸式的用户体验
- ⚙️ **丰富的参数配置**: 
  - 视频比例 (16:9 横屏 / 9:16 竖屏)
  - 视频时长 (10秒 / 15秒)
  - 高清模式选项
- 📱 **响应式设计**: 支持桌面和移动设备
- 🎯 **实时预览**: 生成的视频可直接预览和下载

## 技术栈

- **前端框架**: Next.js 15.5.4
- **样式框架**: Tailwind CSS 4.0
- **开发语言**: TypeScript
- **UI 组件**: React 19.1.0
- **API 集成**: X API (api.xlap.top)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.local` 文件并配置您的 API 密钥：

```bash
# Sora2 AI API 配置
NEXT_PUBLIC_API_KEY=your-actual-api-key-here

# API 端点配置
NEXT_PUBLIC_API_BASE_URL=https://api.xlap.top
```

### 3. 启动开发服务器

```bash
npm run dev
```

应用将在 [http://localhost:3000](http://localhost:3000) 启动。

### 4. 构建生产版本

```bash
npm run build
npm start
```

## API 配置

### 获取 API 密钥

1. 访问 [X API 平台](https://api.xlap.top)
2. 注册账户并获取 API 密钥
3. 将密钥配置到 `.env.local` 文件中

### API 接口说明

**端点**: `https://api.xlap.top/v2/videos/generations`

**请求参数**:
- `prompt` (string, 必需): 视频描述文本
- `model` (string, 必需): 固定值 "sora_video2"
- `images` (array[string], 可选): 图片列表，支持 URL 或 base64
- `aspect_ratio` (string, 可选): 输出比例 ("16:9" 或 "9:16")
- `hd` (boolean, 可选): 是否生成高清，默认 false
- `duration` (string, 可选): 视频时长 ("10" 或 "15")
- `notify_hook` (string, 可选): 回调通知地址

## 项目结构

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── generate-video/
│   │   │       └── route.ts          # API 路由处理
│   │   ├── globals.css               # 全局样式
│   │   ├── layout.tsx                # 应用布局
│   │   └── page.tsx                  # 主页面组件
│   └── ...
├── public/                           # 静态资源
├── .env.local                        # 环境变量配置
├── package.json                      # 项目依赖
└── README.md                         # 项目说明
```

## 使用说明

### 文生视频

1. 选择"文生视频"标签
2. 在提示词输入框中描述您想要的视频内容
3. 配置视频参数（比例、时长、高清选项）
4. 点击"生成视频"按钮
5. 等待生成完成，预览和下载视频

### 图生视频

1. 选择"图生视频"标签
2. 点击"点击上传图片"按钮，选择一张或多张图片
3. 在提示词输入框中描述视频内容
4. 配置视频参数
5. 点击"生成视频"按钮
6. 等待生成完成，预览和下载视频

## 自定义配置

### 修改背景视频

在 `src/app/page.tsx` 中找到以下代码并替换视频 URL：

```tsx
<source src="https://xlaptop.oss-cn-hongkong.aliyuncs.com/bg.mp4" type="video/mp4" />
```

### 调整样式

- 全局样式: 编辑 `src/app/globals.css`
- 组件样式: 在 `src/app/page.tsx` 中修改 Tailwind CSS 类名

### API 配置

- 修改 API 端点: 编辑 `src/app/api/generate-video/route.ts`
- 添加新的参数: 更新接口类型定义和请求处理逻辑

## 部署

### Vercel 部署

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 中导入项目
3. 配置环境变量
4. 部署完成

### 其他平台

支持部署到任何支持 Next.js 的平台，如 Netlify、Railway 等。

## 故障排除

### 常见问题

1. **API 密钥错误**: 确保在 `.env.local` 中正确配置了 API 密钥
2. **视频无法播放**: 检查浏览器是否支持 H.264 视频格式
3. **图片上传失败**: 确保图片格式为 JPG、PNG 等常见格式
4. **网络请求失败**: 检查网络连接和 API 服务状态

### 调试模式

启用开发者工具的网络面板，查看 API 请求和响应详情。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 联系方式

如有问题或建议，请通过以下方式联系：

- GitHub Issues: [项目地址]
- Email: [联系邮箱]
