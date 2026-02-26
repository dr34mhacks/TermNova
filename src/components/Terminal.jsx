import React, { forwardRef, useEffect, useMemo } from 'react';
import { useMultiLineTyping } from '../hooks/useTypingAnimation';
import { themes } from '../utils/themes';
import { parseLines } from '../utils/canvasRenderer';

const Cursor = ({ style, color, blink }) => {
  const cursorClass = blink ? 'animate-blink' : '';

  if (style === 'block') {
    return (
      <span
        className={`inline-block ${cursorClass}`}
        style={{
          backgroundColor: color,
          width: '0.6em',
          height: '1.15em',
          verticalAlign: 'text-bottom',
          marginLeft: '2px',
        }}
      />
    );
  }

  if (style === 'underline') {
    return (
      <span
        className={`inline-block ${cursorClass}`}
        style={{
          backgroundColor: color,
          width: '0.6em',
          height: '3px',
          verticalAlign: 'bottom',
          marginLeft: '2px',
        }}
      />
    );
  }

  // Bar cursor
  return (
    <span
      className={`inline-block ${cursorClass}`}
      style={{
        backgroundColor: color,
        width: '2px',
        height: '1.15em',
        verticalAlign: 'text-bottom',
        marginLeft: '2px',
      }}
    />
  );
};

const Terminal = forwardRef(({
  config,
  lines: rawLines,
  isAnimating,
  showComplete = false,
  forcedDisplayState = null, // For GIF export - directly control what's shown
  onAnimationComplete,
  onReset,
}, ref) => {
  const theme = themes[config.theme] || themes.hacker;

  // Parse lines to determine which have prompts
  const parsedLineInfo = useMemo(() => parseLines(rawLines, config.promptText), [rawLines, config.promptText]);
  const lineTexts = useMemo(() => parsedLineInfo.map(l => l.text), [parsedLineInfo]);

  const { displayedLines, isComplete, reset, progress, currentLineIndex, skipToEnd } = useMultiLineTyping(
    lineTexts,
    config.typingSpeed,
    300,
    isAnimating && !showComplete && !forcedDisplayState,
    {
      outputMode: config.outputMode || 'typing',
      lineInfo: parsedLineInfo,
    }
  );

  // Display priority: forcedDisplayState > showComplete > animation hook
  let effectiveDisplayedLines;
  let effectiveIsComplete;
  let effectiveCurrentLineIndex;

  if (forcedDisplayState) {
    effectiveDisplayedLines = forcedDisplayState.lines;
    effectiveIsComplete = forcedDisplayState.complete;
    effectiveCurrentLineIndex = forcedDisplayState.currentLineIndex;
  } else if (showComplete) {
    effectiveDisplayedLines = lineTexts.map(text => ({ text, complete: true }));
    effectiveIsComplete = true;
    effectiveCurrentLineIndex = lineTexts.length;
  } else {
    effectiveDisplayedLines = displayedLines;
    effectiveIsComplete = isComplete;
    effectiveCurrentLineIndex = currentLineIndex;
  }

  useEffect(() => {
    if (isComplete && onAnimationComplete) {
      onAnimationComplete();
    }
  }, [isComplete, onAnimationComplete]);

  useEffect(() => {
    if (onReset) {
      onReset(reset);
    }
  }, [reset, onReset]);

  const containerStyle = {
    fontFamily: config.font,
    fontSize: `${config.fontSize}px`,
    lineHeight: config.lineHeight,
    width: '100%',
  };

  const windowStyle = {
    backgroundColor: theme.windowBg,
    borderColor: theme.windowBorder,
    borderRadius: `${config.borderRadius}px`,
    overflow: 'hidden',
    position: 'relative',
  };

  const contentStyle = {
    backgroundColor: theme.background,
    color: theme.foreground,
    padding: `${config.padding}px`,
    paddingBottom: `${config.padding + 20}px`, // Extra space for final cursor line
    minHeight: '200px',
    position: 'relative',
  };

  if (config.backgroundImage) {
    contentStyle.backgroundImage = `url(${config.backgroundImage})`;
    contentStyle.backgroundSize = 'cover';
    contentStyle.backgroundPosition = 'center';
  }

  const glowClass = config.glowEffect && theme.glow ? 'terminal-glow' : '';
  const scanlineClass = config.scanlineEffect && theme.scanlines ? 'scanlines' : '';
  const crtClass = config.crtEffect && theme.crt ? 'crt-flicker noise-overlay' : '';

  // Render prompt with support for multi-line prompts
  const renderPrompt = (promptText, theme) => {
    if (!promptText) return null;

    // Check if prompt has newlines (like Parrot/Kali style)
    if (promptText.includes('\n')) {
      const parts = promptText.split('\n');
      return (
        <>
          {parts.slice(0, -1).map((part, i) => (
            <div key={i} style={{ color: theme.prompt }}>{part}</div>
          ))}
          <span style={{ color: theme.prompt }}>{parts[parts.length - 1]}</span>
        </>
      );
    }

    return <span style={{ color: theme.prompt }}>{promptText}</span>;
  };

  return (
    <div ref={ref} style={containerStyle} className="terminal-container">
      <div style={windowStyle} className={`border-2 shadow-2xl ${crtClass}`}>
        {/* Title bar */}
        {config.showTitle && (
          <div
            className="flex items-center px-4 py-2.5"
            style={{ backgroundColor: theme.titleBar }}
          >
            {config.showWindowControls && (
              <div className="flex space-x-2 mr-4">
                <div
                  className="w-3 h-3 rounded-full hover:brightness-110 transition-all"
                  style={{ backgroundColor: theme.buttonRed }}
                />
                <div
                  className="w-3 h-3 rounded-full hover:brightness-110 transition-all"
                  style={{ backgroundColor: theme.buttonYellow }}
                />
                <div
                  className="w-3 h-3 rounded-full hover:brightness-110 transition-all"
                  style={{ backgroundColor: theme.buttonGreen }}
                />
              </div>
            )}
            <span
              className="text-sm opacity-70 flex-1 text-center font-medium"
              style={{ color: theme.foreground }}
            >
              {config.title}
            </span>
            {config.showWindowControls && <div className="w-14" />}
          </div>
        )}

        {/* Terminal content */}
        <div style={contentStyle} className={`${scanlineClass} relative`}>
          {/* Background overlay for image */}
          {config.backgroundImage && (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: theme.background,
                opacity: 1 - config.backgroundOpacity,
              }}
            />
          )}

          {/* Lines */}
          <div className={`relative z-10 ${glowClass}`}>
            {effectiveDisplayedLines.map((line, index) => {
              const lineInfo = parsedLineInfo[index];
              const showPrompt = lineInfo?.showPrompt;
              const isCurrentLine = index === effectiveCurrentLineIndex;
              const showCursor = !showComplete && !forcedDisplayState && !line.complete && isCurrentLine;

              return (
                <div key={index} className="whitespace-pre-wrap break-words">
                  {showPrompt && renderPrompt(config.promptText, theme)}
                  <span style={{ color: showPrompt ? theme.foreground : theme.comment }}>
                    {line.text}
                  </span>
                  {showCursor && (
                    <Cursor
                      style={config.cursorStyle}
                      color={theme.cursor}
                      blink={config.cursorBlink}
                    />
                  )}
                </div>
              );
            })}

            {/* Show cursor on new line when complete */}
            {effectiveIsComplete && effectiveDisplayedLines.length > 0 && (
              <div className="whitespace-pre-wrap">
                {renderPrompt(config.promptText, theme)}
                <Cursor
                  style={config.cursorStyle}
                  color={theme.cursor}
                  blink={config.cursorBlink}
                />
              </div>
            )}

            {/* Empty state */}
            {effectiveDisplayedLines.length === 0 && !isAnimating && !showComplete && (
              <div className="whitespace-pre-wrap opacity-50">
                {renderPrompt(config.promptText, theme)}
                <span>Type something to begin...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {isAnimating && !effectiveIsComplete && !showComplete && (
        <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-150 rounded-full"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: theme.foreground,
              boxShadow: `0 0 10px ${theme.foreground}`,
            }}
          />
        </div>
      )}
    </div>
  );
});

Terminal.displayName = 'Terminal';

export default Terminal;
