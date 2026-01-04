'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface VideoGenerationRequest {
  prompt: string;
  model: 'sora-2' | 'sora-2-pro';
  images: string[];
  aspect_ratio?: '16:9' | '9:16';
  hd?: boolean;
  duration?: '10' | '15';
  notify_hook?: string;
}

interface VideoGenerationResponse {
  task_id: string;
}

interface TaskStatusResponse {
  task_id: string;
  platform: string;
  action: string;
  status: 'NOT_START' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';
  fail_reason: string;
  submit_time: number;
  start_time: number;
  finish_time: number;
  progress: string;
  data: {
    output?: string;
  };
  search_item: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'text-to-video' | 'image-to-video'>('text-to-video');
  const [prompt, setPrompt] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [model, setModel] = useState<'sora-2' | 'sora-2-pro'>('sora-2');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isHD, setIsHD] = useState(false);
  const [duration, setDuration] = useState<'10' | '15'>('10');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatusResponse | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [xKey, setXKey] = useState<string>('');
  const [xKeyValid, setXKeyValid] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const imagePromises = Array.from(files).map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      });

      Promise.all(imagePromises).then(base64Images => {
        setSelectedImages(prev => [...prev, ...base64Images]);
      });
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // 验证X Key的函数
  const validateXKey = useCallback((key: string): boolean => {
    return key.length === 51 && key.startsWith('sk-');
  }, []);

  // 处理X Key输入变化
  const handleXKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setXKey(e.target.value);
  };

  // 处理X Key输入框失焦事件
  const handleXKeyBlur = () => {
    if (!xKey) {
      setXKeyValid(null);
      return;
    }

    const isValid = validateXKey(xKey);
    setXKeyValid(isValid);

    if (isValid) {
      localStorage.setItem('x_api_key', xKey);
    }
  };

  // 清除X Key
  const clearXKey = () => {
    setXKey('');
    setXKeyValid(null);
    localStorage.removeItem('x_api_key');
  };

  // 页面加载时恢复任务状态和X Key
  useEffect(() => {
    // 恢复任务状态
    const savedTaskId = localStorage.getItem('current_task_id');
    if (savedTaskId) {
      setCurrentTaskId(savedTaskId);
      setIsLoading(true);
      // 开始轮询，pollTaskStatus会根据状态自动停止轮询
      startPolling(savedTaskId);
    }

    // 恢复X Key
    const savedXKey = localStorage.getItem('x_api_key');
    if (savedXKey) {
      setXKey(savedXKey);
      setXKeyValid(validateXKey(savedXKey));
    }
  }, [validateXKey]);

  // 查询任务状态
  const pollTaskStatus = async (taskId: string) => {
    try {
      const apiKey = localStorage.getItem('x_api_key');
      if (!apiKey) {
        throw new Error('请先设置有效的X Key');
      }

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.xlap.top';

      const response = await fetch(`${apiBaseUrl}/v2/videos/generations/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`查询任务状态失败: ${response.status}`);
      }

      const result: TaskStatusResponse = await response.json();
      setTaskStatus(result);

      // 处理进度值，确保有百分号
      const normalizeProgress = (progress: string): string => {
        if (!progress) return '';
        // 如果已经包含%，直接返回
        if (progress.includes('%')) return progress;
        // 如果是纯数字，添加%
        const numericValue = parseFloat(progress);
        if (!isNaN(numericValue)) return `${numericValue}%`;
        // 其他情况直接返回原值
        return progress;
      };

      setProgress(normalizeProgress(result.progress));

      // 根据状态更新UI
      switch (result.status) {
        case 'SUCCESS':
          if (result.data.output) {
            setGeneratedVideo(result.data.output);
            setIsLoading(false);
            // 停止轮询
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
          break;
        case 'FAILURE':
          setError(result.fail_reason || '视频生成失败');
          setIsLoading(false);
          // 停止轮询
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          break;
        case 'NOT_START':
        case 'IN_PROGRESS':
          // 继续轮询
          break;
      }
    } catch (err) {
      console.error('Poll task status error:', err);
      setError(err instanceof Error ? err.message : '查询任务状态时发生错误');
    }
  };

  // 开始轮询任务状态
  const startPolling = (taskId: string) => {
    // 清除之前的轮询
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // 立即查询一次
    pollTaskStatus(taskId);

    // 每3秒查询一次
    pollIntervalRef.current = setInterval(() => {
      pollTaskStatus(taskId);
    }, 10000);
  };

  const generateVideo = async () => {
    // 直接调用外部 API
    const apiKey = localStorage.getItem('x_api_key');
    if (!apiKey) {
      setError('请先设置有效的X Key');
      return;
    }

    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }

    // 仅在图生视频模式下检查图片
    if (activeTab === 'image-to-video' && selectedImages.length === 0) {
      setError('请上传至少一张图片');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedVideo(null);
    setTaskStatus(null);
    setProgress('');

    try {
      const requestBody: VideoGenerationRequest = {
        prompt: prompt.trim(),
        model: model,
        aspect_ratio: aspectRatio,
        duration: duration,
        hd: isHD,
        images: [],
      };

      // 仅在图生视频模式下添加图片
      if (activeTab === 'image-to-video') {
        // 将data URL格式的图片转换为纯base64字符串
        const base64Images = selectedImages.map(image => {
          // 移除data URL前缀，只保留base64字符串
          const base64Index = image.indexOf(',');
          return base64Index !== -1 ? image.substring(base64Index + 1) : image;
        });
        requestBody.images = base64Images;
      }
      // 只有 sora-2-pro 模型支持 hd 和 duration
      if (model === 'sora-2-pro') {
        if (isHD) {
          requestBody.hd = isHD;
        }
      }

      const apiBaseUrl = 'https://api.xlap.top';

      const response = await fetch(`${apiBaseUrl}/v2/videos/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }

      const result: VideoGenerationResponse = await response.json();

      if (result.task_id) {
        // 缓存任务ID到本地存储
        setCurrentTaskId(result.task_id);
        localStorage.setItem('current_task_id', result.task_id);

        // 开始轮询任务状态
        startPolling(result.task_id);
      } else {
        throw new Error('未获取到任务ID');
      }
    } catch (err) {
      console.error('Video generation error:', err);
      setError(err instanceof Error ? err.message : '生成视频时发生错误');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 背景视频 */}
      <div className="fixed inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="https://xlaptop.oss-cn-hongkong.aliyuncs.com/bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/50"></div>
      </div>

      {/* 主要内容 */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">Sora2 AI 视频生成</h1>
            <p className="text-white/80 text-lg">使用最先进的 AI 技术，从文本或图片生成高质量视频</p>
            <p className="text-white/80 text-lg"><b>标准￥0.15</b> <small>/次</small>， <b>Pro模型￥2.55</b> <small>/次</small>，不成功自动补偿</p>
          </div>

          {/* 标签切换 */}
          <div className="flex justify-center mb-8">
            <div className="bg-white/20 rounded-lg p-1 flex">
              <button
                onClick={() => setActiveTab('text-to-video')}
                className={`px-6 py-3 rounded-md font-medium transition-all ${activeTab === 'text-to-video'
                  ? 'bg-white text-gray-900 shadow-lg'
                  : 'text-white hover:bg-white/10'
                  }`}
              >
                文生视频
              </button>
              <button
                onClick={() => setActiveTab('image-to-video')}
                className={`px-6 py-3 rounded-md font-medium transition-all ${activeTab === 'image-to-video'
                  ? 'bg-white text-gray-900 shadow-lg'
                  : 'text-white hover:bg-white/10'
                  }`}
              >
                图生视频
              </button>
            </div>
          </div>

          {/* 表单内容 */}
          <div className="space-y-6">
            {/* 提示词输入 */}
            <div>
              <div className="w-full flex justify-between items-center mb-2">
                <div className="w-full flex items-center space-x-2">
                  <div className="w-full relative">
                    <input
                      type="text"
                      value={xKey}
                      onChange={handleXKeyChange}
                      onBlur={handleXKeyBlur}
                      placeholder="输入X Key"
                      className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center">
                      {xKeyValid === true && (
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                      {xKeyValid === false && (
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      )}
                      {xKey && (
                        <button
                          onClick={clearXKey}
                          className="ml-2 text-white/70 hover:text-white"
                          title="清除X Key"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                      )}
                      {!xKey && (
                        <div className="flex items-center">
                          <a
                            href="https://api.xlap.top"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-white hover:text-pink-300"
                            title="获取X Key"
                          >
                            获取
                          </a>

                        </div>
                      )}
                      <div className="relative ml-2 group">
                        <div className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-white  hover:text-pink-300 hover:border-pink-300 cursor-help">
                          <span className="text-xs font-bold">?</span>
                        </div>
                        <div className="absolute z-50 hidden group-hover:block w-68 bg-gray-900 text-white text-sm rounded-lg p-3 shadow-lg -right-2 top-6">
                          <div className="absolute -top-2 right-3 w-4 h-4 bg-gray-900 transform rotate-45"></div>
                          <ol className="space-y-2 list-decimal list-inside">
                            <li>注册登录 X API平台</li>
                            <li>创建令牌，自定义名称，default分组</li>
                            <li>充值余额，并复制至左侧</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述您想要生成的视频内容..."
                className="w-full h-32 px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* 图片上传 (仅在图生视频模式下显示) */}
            {activeTab === 'image-to-video' && (
              <div>
                <label className="block text-white font-medium mb-2">
                  上传图片 *
                </label>
                <div className="space-y-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 bg-white/20 border-2 border-dashed border-white/30 rounded-lg text-white hover:bg-white/30 transition-colors"
                  >
                    点击上传图片
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  {selectedImages.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {selectedImages.map((image, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={image}
                            alt={`上传的图片 ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 参数设置 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-white font-medium mb-2">
                  AI 模型
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as 'sora-2' | 'sora-2-pro')}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sora-2" className="text-gray-900">Sora-2 (标准)</option>
                  <option value="sora-2-pro" className="text-gray-900">Sora-2-Pro (支持高清和15秒)</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-medium mb-2">
                  视频比例
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="16:9" className="text-gray-900">16:9 横屏</option>
                  <option value="9:16" className="text-gray-900">9:16 竖屏</option>
                </select>
              </div>
            </div>

            {/* Pro 模型专用设置 */}
            {model === 'sora-2-pro' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="block text-white font-medium mb-2">
                    视频时长
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value as '10' | '15')}
                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="10" className="text-gray-900">10秒</option>
                    <option value="15" className="text-gray-900">15秒</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    清晰度
                  </label>
                  <label className="flex w-full py-3 text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isHD}
                      onChange={(e) => setIsHD(e.target.checked)}
                      className="mr-3 w-5 h-5 text-blue-600 bg-white/20 border-white/30 rounded focus:ring-blue-500"
                    />
                    高清模式 (较慢)
                  </label>
                </div>
              </div>
            )}

            {/* 错误信息 */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-200">{error}</p>
              </div>
            )}

            {/* 生成说明 */}
            {isLoading && (
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
                <div className="text-blue-200">
                  <h4 className="font-medium mb-2">视频生成说明</h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>模型：</strong>{model === 'sora-2' ? 'Sora-2 (标准)' : 'Sora-2-Pro (专业)'}
                    </p>
                    <p>
                      <strong>预计生成时间：</strong>
                      {model === 'sora-2'
                        ? '1-3 分钟'
                        : duration === '10'
                          ? (isHD ? '9-11 分钟' : '1-3 分钟')
                          : (isHD ? '12-14 分钟' : '3-5 分钟')
                      }
                      {model === 'sora-2-pro' && isHD && ' (高清模式)'}
                    </p>
                    <div>
                      <p><strong>审查说明：</strong>官方审查涉及以下阶段：</p>
                      <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                        <li>提交的图片中是否涉及真人（非常像真人的也不行）</li>
                        <li>提示词内容是否违规（暴力、色情、版权、活着的名人）</li>
                        <li>生成结果审查是否合格（这也是大家经常看到的生成了90%多后失败的原因）</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 任务状态显示 */}
            {taskStatus && (
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">任务状态</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${taskStatus.status === 'SUCCESS' ? 'bg-green-500/20 text-green-300' :
                      taskStatus.status === 'FAILURE' ? 'bg-red-500/20 text-red-300' :
                        taskStatus.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-gray-500/20 text-gray-300'
                      }`}>
                      {taskStatus.status === 'NOT_START' && '未开始'}
                      {taskStatus.status === 'IN_PROGRESS' && '正在执行'}
                      {taskStatus.status === 'SUCCESS' && '执行完成'}
                      {taskStatus.status === 'FAILURE' && '失败'}
                    </span>
                    {(taskStatus.status === 'SUCCESS' || taskStatus.status === 'FAILURE') && (
                      <button
                        onClick={() => {
                          setTaskStatus(null);
                          setCurrentTaskId(null);
                          setProgress('');
                          localStorage.removeItem('current_task_id');
                          if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                          }
                        }}
                        className="px-2 py-1 bg-gray-500/20 text-gray-300 rounded text-xs hover:bg-gray-500/30 transition-colors"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </div>
                {progress && (
                  <div className="mb-2">
                    <div className="flex justify-between text-sm text-white/80 mb-1">
                      <span>进度</span>
                      <span>{progress}</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: progress }}
                      ></div>
                    </div>
                  </div>
                )}
                {taskStatus.fail_reason && (
                  <p className="text-red-300 text-sm mt-2">{taskStatus.fail_reason}</p>
                )}
                <p className="text-white/60 text-sm">任务ID: {taskStatus.task_id}</p>
              </div>
            )}

            {/* 生成按钮 */}
            <button
              onClick={generateVideo}
              disabled={isLoading}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  {taskStatus?.status === 'IN_PROGRESS' ? '生成中...' :
                    taskStatus?.status === 'NOT_START' ? '等待开始...' : '提交中...'}
                </div>
              ) : (
                '生成视频'
              )}
            </button>

            {/* 生成结果 */}
            {generatedVideo && (
              <div className="bg-white/10 rounded-lg p-6">
                <h3 className="text-white font-medium mb-4">生成的视频</h3>
                <video
                  src={generatedVideo}
                  controls
                  className="w-full rounded-lg"
                >
                  您的浏览器不支持视频播放。
                </video>
                <div className="mt-4 flex gap-4">
                  <a
                    href={generatedVideo}
                    download
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    下载视频
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedVideo)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    复制链接
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
