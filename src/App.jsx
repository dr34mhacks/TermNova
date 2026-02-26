import React, { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import Terminal from './components/Terminal';
import { themes, fonts, cursorStyles, promptPresets, defaultConfig } from './utils/themes';
import { createGIF } from './utils/gifEncoder';
import { parseLines, generateAnimationFrames } from './utils/canvasRenderer';
import {
  Play,
  RotateCcw,
  Download,
  Palette,
  Sparkles,
  Terminal as TerminalIcon,
  Zap,
  Monitor,
  FileImage,
  Film,
  Copy,
  Check,
  Maximize,
  Star,
  Github,
} from 'lucide-react';

// Resolution presets for different platforms
const resolutionPresets = {
  auto: { name: 'Auto (Fit Content)', width: null, height: null },
  linkedin: { name: 'LinkedIn Post', width: 1200, height: 627 },
  twitter: { name: 'Twitter/X Post', width: 1200, height: 675 },
  instagram: { name: 'Instagram Square', width: 1080, height: 1080 },
  github: { name: 'GitHub README', width: 1280, height: 640 },
  discord: { name: 'Discord Embed', width: 1200, height: 630 },
  youtube: { name: 'YouTube Thumbnail', width: 1280, height: 720 },
  og: { name: 'Open Graph', width: 1200, height: 630 },
  hd: { name: 'HD 1080p', width: 1920, height: 1080 },
};

const demoText = `> nmap -sV -sC 10.10.10.45
!!
Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for 10.10.10.45
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.2
80/tcp   open  http    Apache 2.4.41
3306/tcp open  mysql   MySQL 5.7.32
!!
> sqlmap -u "http://10.10.10.45/login" --dbs
!!
[*] starting sqlmap v1.7
[+] Parameter 'id' is vulnerable
[+] available databases [3]:
    - information_schema
    - users_db
    - admin_panel
!!
> hashcat -m 0 hash.txt rockyou.txt
!!
[+] Status: Cracked
[+] Hash: 5f4dcc3b5aa765d61d8327deb882cf99
[+] Pass: password123
!!`;

export default function App() {
  const [config, setConfig] = useState(defaultConfig);
  const [inputText, setInputText] = useState(demoText);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('editor');
  const [copied, setCopied] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState('auto');

  const terminalRef = useRef(null);
  const staticTerminalRef = useRef(null);
  // Split lines but preserve blank lines for proper spacing
  const lines = inputText.split('\n').filter((line, index, arr) => {
    // Keep non-empty lines
    if (line.trim() !== '') return true;
    // Keep blank lines that are between content (not trailing)
    const hasContentAfter = arr.slice(index + 1).some(l => l.trim() !== '');
    return hasContentAfter;
  });

  const updateConfig = (key, value) => setConfig((prev) => ({ ...prev, [key]: value }));

  const handlePlay = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      setAnimationKey((prev) => prev + 1);
      setIsAnimating(true);
    }, 50);
  }, []);

  const handleReset = useCallback(() => {
    setIsAnimating(false);
    setAnimationKey((prev) => prev + 1);
  }, []);

  const exportAsPNG = async () => {
    if (!staticTerminalRef.current) return;
    setIsExporting(true);
    try {
      const preset = resolutionPresets[selectedResolution];
      const theme = themes[config.theme] || themes.hacker;

      // Always capture at 2x scale for crisp, retina-quality text
      const captureScale = 2;

      let canvas = await html2canvas(staticTerminalRef.current, {
        backgroundColor: theme.background,
        scale: captureScale,
        logging: false,
        useCORS: true,
      });

      // For specific resolution presets, create a 2x canvas for retina quality
      if (preset.width && preset.height) {
        // Output at 2x resolution for crisp text
        const outputScale = 2;
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = preset.width * outputScale;
        resizedCanvas.height = preset.height * outputScale;
        const ctx = resizedCanvas.getContext('2d');

        // Fill with theme background
        ctx.fillStyle = theme.background;
        ctx.fillRect(0, 0, resizedCanvas.width, resizedCanvas.height);

        // Small padding on all sides for aesthetics (scaled)
        const padding = 10 * outputScale;
        const maxWidth = resizedCanvas.width - (padding * 2);
        const maxHeight = resizedCanvas.height - (padding * 2);
        const aspectRatio = canvas.width / canvas.height;

        // First try to fill the full width
        let targetWidth = maxWidth;
        let targetHeight = maxWidth / aspectRatio;

        // If height exceeds available space, scale down to fit height
        if (targetHeight > maxHeight) {
          targetHeight = maxHeight;
          targetWidth = maxHeight * aspectRatio;
        }

        // Center both horizontally and vertically
        const drawX = padding + (maxWidth - targetWidth) / 2;
        const drawY = padding + (maxHeight - targetHeight) / 2;

        // Use high quality smoothing for any necessary scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, drawX, drawY, targetWidth, targetHeight);
        canvas = resizedCanvas;
      } else {
        // Auto mode - use capture directly with background
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = canvas.width;
        resizedCanvas.height = canvas.height;
        const ctx = resizedCanvas.getContext('2d');
        ctx.fillStyle = theme.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(canvas, 0, 0);
        canvas = resizedCanvas;
      }

      const link = document.createElement('a');
      link.download = `terminal-${selectedResolution}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsGIF = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setIsAnimating(false);

    try {
      const theme = themes[config.theme] || themes.hacker;
      const preset = resolutionPresets[selectedResolution];

      // Parse lines to get line info
      const parsedLineInfo = parseLines(lines, config.promptText);

      setExportProgress(0.1);

      // Generate all animation frames using canvas rendering
      // Pass target dimensions if a specific resolution is selected
      const frames = generateAnimationFrames(parsedLineInfo, config, theme, {
        targetFrameCount: 40,
        typingSpeed: config.typingSpeed,
        targetWidth: preset.width,
        targetHeight: preset.height,
      });

      setExportProgress(0.3);

      // Generate the GIF
      const gifBlob = await createGIF(frames, {
        width: frames[0]?.canvas.width || 800,
        height: frames[0]?.canvas.height || 400,
        onProgress: (p) => setExportProgress(0.3 + p * 0.7),
      });

      if (gifBlob) {
        const link = document.createElement('a');
        link.download = `terminal-animation.gif`;
        link.href = URL.createObjectURL(gifBlob);
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const copyAsSVG = async () => {
    if (!staticTerminalRef.current) return;
    try {
      const preset = resolutionPresets[selectedResolution];
      const theme = themes[config.theme] || themes.hacker;

      // Always capture at 2x scale for crisp text
      const captureScale = 2;

      let canvas = await html2canvas(staticTerminalRef.current, {
        backgroundColor: theme.background,
        scale: captureScale,
        logging: false,
        useCORS: true,
      });

      let width, height;

      // For specific resolution presets
      if (preset.width && preset.height) {
        // Output at 2x resolution for crisp text
        const outputScale = 2;
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = preset.width * outputScale;
        resizedCanvas.height = preset.height * outputScale;
        const ctx = resizedCanvas.getContext('2d');

        ctx.fillStyle = theme.background;
        ctx.fillRect(0, 0, resizedCanvas.width, resizedCanvas.height);

        // Small padding on all sides (scaled)
        const padding = 10 * outputScale;
        const maxWidth = resizedCanvas.width - (padding * 2);
        const maxHeight = resizedCanvas.height - (padding * 2);
        const aspectRatio = canvas.width / canvas.height;

        // First try to fill the full width
        let targetWidth = maxWidth;
        let targetHeight = maxWidth / aspectRatio;

        // If height exceeds available space, scale down to fit height
        if (targetHeight > maxHeight) {
          targetHeight = maxHeight;
          targetWidth = maxHeight * aspectRatio;
        }

        // Center both horizontally and vertically
        const drawX = padding + (maxWidth - targetWidth) / 2;
        const drawY = padding + (maxHeight - targetHeight) / 2;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, drawX, drawY, targetWidth, targetHeight);
        canvas = resizedCanvas;
        // SVG dimensions at 1x (the image inside is 2x for retina)
        width = preset.width;
        height = preset.height;
      } else {
        // Auto mode - use capture directly with background
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = canvas.width;
        resizedCanvas.height = canvas.height;
        const ctx = resizedCanvas.getContext('2d');
        ctx.fillStyle = theme.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(canvas, 0, 0);
        canvas = resizedCanvas;
        width = canvas.width / 2; // Display at 1x, image is 2x
        height = canvas.height / 2;
      }

      const dataUrl = canvas.toDataURL('image/png');
      // SVG displays at 1x dimensions but contains 2x image for retina quality
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="${dataUrl}" width="${width}" height="${height}"/></svg>`;
      await navigator.clipboard.writeText(svg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent fail - clipboard may not be available
    }
  };

  const tabs = [
    { id: 'editor', label: 'Editor', icon: TerminalIcon },
    { id: 'themes', label: 'Themes', icon: Palette },
    { id: 'style', label: 'Style', icon: Sparkles },
    { id: 'export', label: 'Export', icon: Download },
  ];

  const currentTheme = themes[config.theme] || themes.hacker;

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)' }}>
      {/* Animated mesh background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-violet-600/20 via-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-emerald-600/15 via-teal-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-radial from-blue-500/5 via-transparent to-transparent rounded-full blur-2xl" />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />

        {/* Floating particles effect */}
        <div className="absolute top-20 left-20 w-2 h-2 bg-green-400/30 rounded-full animate-bounce" style={{ animationDuration: '3s' }} />
        <div className="absolute top-40 right-32 w-1.5 h-1.5 bg-purple-400/30 rounded-full animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-1/3 w-2 h-2 bg-cyan-400/30 rounded-full animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/10 backdrop-blur-2xl bg-gradient-to-r from-black/40 via-black/30 to-black/40">
          <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 rounded-2xl blur opacity-40 group-hover:opacity-60 transition-opacity" />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-green-500/20">
                  <Monitor size={24} className="text-white drop-shadow-lg" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  <span className="bg-gradient-to-r from-green-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">Term</span>
                  <span className="text-white/90">Nova</span>
                </h1>
                <p className="text-sm text-gray-400 font-light">Create stunning terminal showcases</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleReset}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-white/5"
                title="Reset"
              >
                <RotateCcw size={18} className="text-gray-400" />
              </button>
              <button
                onClick={handlePlay}
                disabled={isAnimating || !inputText.trim()}
                className="group relative flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
                style={{
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.3), 0 0 40px rgba(16, 185, 129, 0.1)'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Play size={18} fill="currentColor" className="relative z-10 drop-shadow-lg" />
                <span className="relative z-10 drop-shadow-lg">{isAnimating ? 'Playing...' : 'Play Animation'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-10">
          {/* Terminal Preview */}
          <div className="mb-10">
            {isExporting && (
              <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                    <span className="text-sm text-purple-200 font-medium">Creating your masterpiece...</span>
                  </div>
                  <span className="text-sm text-purple-300 font-mono bg-purple-500/20 px-3 py-1 rounded-lg">{Math.round(exportProgress * 100)}%</span>
                </div>
                <div className="h-2.5 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 transition-all duration-300 rounded-full relative"
                    style={{ width: `${exportProgress * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  </div>
                </div>
              </div>
            )}

            <div className="relative group">
              {/* Animated glow border */}
              <div
                className="absolute -inset-1 rounded-2xl blur-xl opacity-60 transition-opacity duration-500 group-hover:opacity-80"
                style={{ background: `linear-gradient(135deg, ${currentTheme.foreground}30, ${currentTheme.prompt}20, ${currentTheme.accent || currentTheme.foreground}30)` }}
              />
              <div
                className="absolute -inset-0.5 rounded-2xl opacity-30"
                style={{ background: `linear-gradient(135deg, ${currentTheme.foreground}50, transparent, ${currentTheme.prompt}50)` }}
              />
              <div className="relative">
                <Terminal
                  key={animationKey}
                  ref={terminalRef}
                  config={config}
                  lines={lines}
                  isAnimating={isAnimating}
                  onAnimationComplete={() => {}}
                  onReset={() => {}}
                />
              </div>
            </div>

            {/* Hidden terminal for PNG/SVG export */}
            <div
              className="absolute -left-[9999px] pointer-events-none"
              style={{
                width: resolutionPresets[selectedResolution]?.width
                  ? `${resolutionPresets[selectedResolution].width}px`
                  : '1200px'
              }}
            >
              <Terminal
                ref={staticTerminalRef}
                config={config}
                lines={lines}
                isAnimating={false}
                showComplete={true}
                onAnimationComplete={() => {}}
                onReset={() => {}}
              />
            </div>
          </div>

          {/* Tabs Card */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-green-500/10 via-purple-500/10 to-cyan-500/10 rounded-3xl blur-xl opacity-50" />
            <div className="relative bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/20">
              {/* Tab Headers */}
              <div className="flex border-b border-white/10 bg-black/20">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center space-x-2.5 py-4 text-sm font-medium transition-all duration-300 relative ${
                      activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {activeTab === tab.id && (
                      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent" />
                    )}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-green-500 via-emerald-400 to-teal-500 rounded-full" />
                    )}
                    <tab.icon size={18} className={`relative z-10 ${activeTab === tab.id ? 'text-emerald-400' : ''}`} />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {/* Editor Tab */}
                {activeTab === 'editor' && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-300">Terminal Input</label>
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <span>Tip:</span>
                          <code className="px-2 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">&gt;</code>
                          <span>command</span>
                          <span className="text-gray-600 mx-1">|</span>
                          <code className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">!!</code>
                          <span>instant output</span>
                        </div>
                      </div>
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/30 to-cyan-500/30 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
                        <textarea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          rows={8}
                          className="relative w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500/50 resize-none transition-all"
                          spellCheck={false}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-300 mb-3 block">Prompt Presets</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {Object.entries(promptPresets).map(([key, preset]) => (
                          <button
                            key={key}
                            onClick={() => {
                              updateConfig('promptText', preset.prompt);
                              updateConfig('promptStyle', key);
                            }}
                            className={`group relative p-3 rounded-xl text-left transition-all duration-300 overflow-hidden ${
                              config.promptStyle === key
                                ? 'bg-green-500/20 border-green-500/50'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            } border`}
                          >
                            {config.promptStyle === key && (
                              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent" />
                            )}
                            <div className="relative">
                              <div className="text-[10px] font-mono text-green-400 truncate mb-1">{preset.preview}</div>
                              <div className="text-xs text-gray-400">{preset.name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Window Title</label>
                        <input
                          type="text"
                          value={config.title}
                          onChange={(e) => updateConfig('title', e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-green-500/50 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400 mb-2 block">Custom Prompt</label>
                        <textarea
                          value={config.promptText}
                          onChange={(e) => updateConfig('promptText', e.target.value)}
                          rows={2}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-green-500/50 transition-all resize-none"
                          placeholder="e.g. $ or ┌──(user㉿host)-[~]&#10;└─$ "
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Themes Tab */}
                {activeTab === 'themes' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Object.entries(themes).map(([key, theme]) => (
                      <button
                        key={key}
                        onClick={() => updateConfig('theme', key)}
                        className={`group relative p-3 rounded-xl text-left transition-all duration-300 overflow-hidden ${
                          config.theme === key
                            ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-[#0a0a12]'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: theme.windowBg }}
                      >
                        <div
                          className="h-16 rounded-lg mb-2 flex items-end p-2 font-mono text-xs overflow-hidden"
                          style={{ backgroundColor: theme.background, color: theme.foreground }}
                        >
                          <span style={{ color: theme.prompt }}>$</span>
                          <span className="ml-1">whoami</span>
                          <span
                            className="ml-1 w-2 h-4 animate-pulse"
                            style={{ backgroundColor: theme.cursor }}
                          />
                        </div>
                        <div className="text-sm text-white font-medium">{theme.name}</div>
                        <div className="text-[10px] text-gray-400 truncate">{theme.description}</div>
                        {config.theme === key && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                            <Check size={12} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Style Tab */}
                {activeTab === 'style' && (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-sm mb-3">
                          <span className="text-gray-300 flex items-center space-x-2">
                            <Zap size={14} className="text-yellow-500" />
                            <span>Typing Speed</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-green-500/10 text-green-400 font-mono text-xs">{config.typingSpeed}ms</span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={150}
                          value={config.typingSpeed}
                          onChange={(e) => updateConfig('typingSpeed', Number(e.target.value))}
                          className="w-full accent-green-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-3">
                          <span className="text-gray-300">Font Size</span>
                          <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-400 font-mono text-xs">{config.fontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min={12}
                          max={24}
                          value={config.fontSize}
                          onChange={(e) => updateConfig('fontSize', Number(e.target.value))}
                          className="w-full accent-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-gray-300 mb-3 block">Font Family</label>
                        <select
                          value={config.font}
                          onChange={(e) => updateConfig('font', e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500/50"
                        >
                          {fonts.map((f) => (
                            <option key={f.value} value={f.value}>{f.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-sm text-gray-300 mb-3 block">Cursor Style</label>
                        <div className="flex space-x-2">
                          {cursorStyles.map((style) => (
                            <button
                              key={style.value}
                              onClick={() => updateConfig('cursorStyle', style.value)}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                                config.cursorStyle === style.value
                                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25'
                                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                              }`}
                            >
                              {style.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm text-gray-300 block mb-1">Animation & Effects</label>

                      {[
                        { key: 'glowEffect', label: 'Text Glow', icon: '✨', color: 'yellow' },
                        { key: 'scanlineEffect', label: 'Scanlines', icon: '📺', color: 'purple' },
                        { key: 'crtEffect', label: 'CRT Flicker', icon: '💫', color: 'pink' },
                        { key: 'cursorBlink', label: 'Cursor Blink', icon: '⎸', color: 'green' },
                        { key: 'showTitle', label: 'Title Bar', icon: '🪟', color: 'blue' },
                        { key: 'showWindowControls', label: 'Window Buttons', icon: '🔴', color: 'red' },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                            config[item.key]
                              ? 'bg-gradient-to-r from-' + item.color + '-500/10 to-transparent border-' + item.color + '-500/30'
                              : 'bg-white/5 hover:bg-white/10 border-white/10'
                          } border`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-sm text-gray-200">{item.label}</span>
                          </div>
                          <div
                            onClick={() => updateConfig(item.key, !config[item.key])}
                            className={`relative w-12 h-6 rounded-full transition-all duration-300 cursor-pointer ${
                              config[item.key]
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/30'
                                : 'bg-gray-700'
                            }`}
                          >
                            <div
                              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${
                                config[item.key] ? 'left-7' : 'left-1'
                              }`}
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Export Tab */}
                {activeTab === 'export' && (
                  <div className="space-y-6">
                    {/* Resolution Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-300 flex items-center space-x-2">
                          <Maximize size={14} className="text-cyan-400" />
                          <span>Resolution Preset</span>
                        </label>
                        {selectedResolution !== 'auto' && (
                          <span className="text-xs text-cyan-400 font-mono">
                            {resolutionPresets[selectedResolution].width} x {resolutionPresets[selectedResolution].height}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {Object.entries(resolutionPresets).map(([key, preset]) => (
                          <button
                            key={key}
                            onClick={() => setSelectedResolution(key)}
                            className={`p-3 rounded-xl text-center transition-all duration-300 ${
                              selectedResolution === key
                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/50 text-white'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                            } border`}
                          >
                            <div className="text-xs font-medium truncate">{preset.name}</div>
                            {preset.width && (
                              <div className="text-[10px] opacity-60 mt-1">{preset.width}×{preset.height}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <button
                        onClick={exportAsGIF}
                        disabled={isExporting || !inputText.trim()}
                        className="group relative flex flex-col items-center justify-center p-8 rounded-2xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-600 to-purple-600 opacity-90" />
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10" />
                        <Film size={36} className="relative z-10 mb-3" />
                        <span className="relative z-10 font-bold text-lg">Export GIF</span>
                        <span className="relative z-10 text-xs opacity-70 mt-1">Animated recording</span>
                      </button>

                      <button
                        onClick={exportAsPNG}
                        disabled={isExporting || !inputText.trim()}
                        className="group relative flex flex-col items-center justify-center p-8 rounded-2xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-cyan-600 to-blue-600 opacity-90" />
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <FileImage size={36} className="relative z-10 mb-3" />
                        <span className="relative z-10 font-bold text-lg">Export PNG</span>
                        <span className="relative z-10 text-xs opacity-70 mt-1">High quality image</span>
                      </button>

                      <button
                        onClick={copyAsSVG}
                        disabled={isExporting || !inputText.trim()}
                        className="group relative flex flex-col items-center justify-center p-8 rounded-2xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-600 via-amber-600 to-orange-600 opacity-90" />
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-amber-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {copied ? <Check size={36} className="relative z-10 mb-3" /> : <Copy size={36} className="relative z-10 mb-3" />}
                        <span className="relative z-10 font-bold text-lg">{copied ? 'Copied!' : 'Copy SVG'}</span>
                        <span className="relative z-10 text-xs opacity-70 mt-1">To clipboard</span>
                      </button>
                    </div>

                    <div className="p-5 rounded-2xl bg-gradient-to-r from-gray-800/30 to-gray-900/30 border border-white/5">
                      <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center space-x-2">
                        <Sparkles size={14} className="text-yellow-500" />
                        <span>Pro Tips</span>
                      </h3>
                      <ul className="text-sm text-gray-500 space-y-2">
                        <li className="flex items-start space-x-2">
                          <span className="text-green-400">•</span>
                          <span><strong className="text-gray-300">Instant Output</strong> — Wrap output lines with <code className="px-1 py-0.5 rounded bg-cyan-500/15 text-cyan-400 text-xs">!!</code> for instant display in GIF</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="text-cyan-400">•</span>
                          <span><strong className="text-gray-300">Resolution</strong> — Select a preset to match your target platform</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="text-purple-400">•</span>
                          <span><strong className="text-gray-300">GIF</strong> — Perfect for Twitter, GitHub READMEs, and Discord</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="text-blue-400">•</span>
                          <span><strong className="text-gray-300">PNG</strong> — Best for documentation, blogs, and presentations</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 py-10 mt-12 bg-gradient-to-t from-black/30 to-transparent">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <span className="text-xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">Term</span>
              <span className="text-xl font-bold text-white/90">Nova</span>
            </div>
            <p className="text-sm text-gray-400 mb-5">
              Create stunning terminal showcases for your projects
            </p>
            <a
              href="https://github.com/dr34mhacks/TermNova"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-gray-800/80 to-gray-900/80 border border-white/10 hover:border-green-500/50 transition-all duration-300 hover:scale-105 group"
            >
              <Github size={18} className="text-gray-400 group-hover:text-white transition-colors" />
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">dr34mhacks/TermNova</span>
              <Star size={16} className="text-yellow-500 group-hover:text-yellow-400 transition-colors" />
            </a>
            <p className="text-xs text-gray-600 mt-5">
              All processing happens locally in your browser
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
