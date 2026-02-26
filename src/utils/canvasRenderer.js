// Canvas-based terminal renderer for GIF export

// Calculate canvas dimensions based on content
function calculateCanvasDimensions(config, theme, lines, scale) {
  const fontSize = config.fontSize * scale;
  const padding = config.padding * scale;
  const lineHeight = config.lineHeight;
  const titleBarHeight = config.showTitle ? 40 * scale : 0;

  // Create a temporary canvas to measure text
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = `400 ${fontSize}px ${config.font || 'monospace'}`;

  // Calculate required width based on longest line
  let maxLineWidth = 0;
  for (const line of lines) {
    let lineWidth = 0;

    // Add prompt width if applicable
    if (line.showPrompt && config.promptText) {
      const promptParts = config.promptText.split('\n');
      const lastPromptPart = promptParts[promptParts.length - 1];
      lineWidth += measureCtx.measureText(lastPromptPart).width;
    }

    // Add text width
    lineWidth += measureCtx.measureText(line.text || '').width;
    maxLineWidth = Math.max(maxLineWidth, lineWidth);
  }

  // Calculate total width (content + padding + some margin)
  const contentWidth = maxLineWidth + (padding * 2) + (40 * scale);
  const totalWidth = Math.max(400 * scale, contentWidth);

  // Calculate required height based on content
  let totalLines = 0;
  for (const line of lines) {
    if (line.showPrompt && config.promptText && config.promptText.includes('\n')) {
      totalLines += config.promptText.split('\n').length - 1;
    }
    totalLines += 1;
  }
  // Add one more line for final cursor
  if (config.promptText && config.promptText.includes('\n')) {
    totalLines += config.promptText.split('\n').length;
  } else {
    totalLines += 1;
  }

  const contentHeight = (totalLines * fontSize * lineHeight) + (padding * 2) + (20 * scale);
  const totalHeight = titleBarHeight + Math.max(100 * scale, contentHeight);

  return { width: totalWidth, height: totalHeight };
}

// Draw the terminal window onto a canvas context at specified position and size
function drawTerminal(ctx, config, theme, displayState, terminalX, terminalY, terminalWidth, terminalHeight, scale) {
  const { lines, showCursor = false, cursorLineIndex = -1 } = displayState;

  const fontSize = config.fontSize * scale;
  const padding = config.padding * scale;
  const lineHeight = config.lineHeight;
  const titleBarHeight = config.showTitle ? 40 * scale : 0;
  const borderRadius = config.borderRadius * scale;

  // Save context state
  ctx.save();
  ctx.translate(terminalX, terminalY);

  // Fill with window background
  ctx.fillStyle = theme.windowBg;
  roundRect(ctx, 0, 0, terminalWidth, terminalHeight, borderRadius);
  ctx.fill();

  // Draw window border
  ctx.strokeStyle = theme.windowBorder;
  ctx.lineWidth = 2 * scale;
  roundRect(ctx, 1, 1, terminalWidth - 2, terminalHeight - 2, borderRadius);
  ctx.stroke();

  // Draw title bar
  if (config.showTitle) {
    ctx.save();
    ctx.beginPath();
    roundRectTop(ctx, 0, 0, terminalWidth, titleBarHeight, borderRadius);
    ctx.clip();
    ctx.fillStyle = theme.titleBar;
    ctx.fillRect(0, 0, terminalWidth, titleBarHeight);
    ctx.restore();

    // Draw window control buttons
    if (config.showWindowControls) {
      const buttonY = titleBarHeight / 2;
      const buttonRadius = 6 * scale;
      const buttonSpacing = 20 * scale;
      const startX = 16 * scale;

      ctx.fillStyle = theme.buttonRed;
      ctx.beginPath();
      ctx.arc(startX, buttonY, buttonRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.buttonYellow;
      ctx.beginPath();
      ctx.arc(startX + buttonSpacing, buttonY, buttonRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.buttonGreen;
      ctx.beginPath();
      ctx.arc(startX + buttonSpacing * 2, buttonY, buttonRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw title text centered
    ctx.fillStyle = theme.foreground;
    ctx.globalAlpha = 0.7;
    ctx.font = `500 ${14 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.title || 'Terminal', terminalWidth / 2, titleBarHeight / 2);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // Draw terminal content area
  const contentY = titleBarHeight;
  ctx.fillStyle = theme.background;
  if (config.showTitle) {
    ctx.fillRect(0, contentY, terminalWidth, terminalHeight - titleBarHeight);
  } else {
    ctx.save();
    roundRect(ctx, 0, 0, terminalWidth, terminalHeight, borderRadius);
    ctx.clip();
    ctx.fillRect(0, 0, terminalWidth, terminalHeight);
    ctx.restore();
  }

  // Set up text rendering
  ctx.font = `400 ${fontSize}px ${config.font || 'monospace'}`;
  ctx.textBaseline = 'top';

  let currentY = contentY + padding;

  // Render each line
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let currentX = padding;

    // Draw prompt if this is a command line
    if (line.showPrompt && config.promptText) {
      const promptParts = config.promptText.split('\n');

      if (promptParts.length > 1) {
        for (let p = 0; p < promptParts.length - 1; p++) {
          ctx.fillStyle = theme.prompt;
          ctx.fillText(promptParts[p], currentX, currentY);
          currentY += fontSize * lineHeight;
        }
        ctx.fillStyle = theme.prompt;
        ctx.fillText(promptParts[promptParts.length - 1], currentX, currentY);
        currentX += ctx.measureText(promptParts[promptParts.length - 1]).width;
      } else {
        ctx.fillStyle = theme.prompt;
        ctx.fillText(config.promptText, currentX, currentY);
        currentX += ctx.measureText(config.promptText).width;
      }
    }

    // Draw text content
    const textColor = line.showPrompt ? theme.foreground : theme.comment;
    ctx.fillStyle = textColor;
    ctx.fillText(line.text || '', currentX, currentY);

    // Draw cursor if this is the current line
    if (showCursor && cursorLineIndex === lineIdx) {
      const textWidth = ctx.measureText(line.text || '').width;
      drawCursor(ctx, currentX + textWidth + 2 * scale, currentY, fontSize, theme.cursor, config.cursorStyle, scale);
    }

    currentY += fontSize * lineHeight;
  }

  // Draw cursor at end (new line) if animation is complete
  if (showCursor && cursorLineIndex >= lines.length) {
    let cursorX = padding;

    if (config.promptText) {
      const promptParts = config.promptText.split('\n');
      if (promptParts.length > 1) {
        for (let p = 0; p < promptParts.length - 1; p++) {
          ctx.fillStyle = theme.prompt;
          ctx.fillText(promptParts[p], cursorX, currentY);
          currentY += fontSize * lineHeight;
        }
        ctx.fillStyle = theme.prompt;
        ctx.fillText(promptParts[promptParts.length - 1], cursorX, currentY);
        cursorX += ctx.measureText(promptParts[promptParts.length - 1]).width;
      } else {
        ctx.fillStyle = theme.prompt;
        ctx.fillText(config.promptText, cursorX, currentY);
        cursorX += ctx.measureText(config.promptText).width;
      }
    }

    drawCursor(ctx, cursorX + 2 * scale, currentY, fontSize, theme.cursor, config.cursorStyle, scale);
  }

  // Restore context state
  ctx.restore();
}

export function createTerminalCanvas(config, theme, displayState, options = {}) {
  const {
    scale = 2,
    fixedWidth = null,
    fixedHeight = null,
  } = options;

  const { lines } = displayState;

  // Determine terminal/canvas size
  // If fixed dimensions provided, use those (terminal fills the entire canvas)
  // Otherwise calculate from content
  let canvasWidth, canvasHeight;

  if (fixedWidth && fixedHeight) {
    canvasWidth = fixedWidth;
    canvasHeight = fixedHeight;
  } else {
    const dims = calculateCanvasDimensions(config, theme, lines, scale);
    canvasWidth = dims.width;
    canvasHeight = dims.height;
  }

  // Terminal fills the entire canvas
  const terminalWidth = canvasWidth;
  const terminalHeight = canvasHeight;

  // Create the canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');

  // Draw terminal filling the entire canvas
  drawTerminal(ctx, config, theme, displayState, 0, 0, terminalWidth, terminalHeight, scale);

  return canvas;
}

function drawCursor(ctx, x, y, fontSize, color, style, scale) {
  ctx.fillStyle = color;
  const width = fontSize * 0.6;
  const height = fontSize * 1.1;

  if (style === 'block') {
    ctx.fillRect(x, y, width, height);
  } else if (style === 'underline') {
    ctx.fillRect(x, y + height - 3 * scale, width, 3 * scale);
  } else {
    ctx.fillRect(x, y, 2 * scale, height);
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function roundRectTop(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Parse input lines: > prefix = command, !! markers = instant output block
export function parseLines(inputLines, promptText) {
  const result = [];
  let inInstantBlock = false;

  for (const line of inputLines) {
    const trimmed = line.trim();

    // Check for !! block marker (line contains only !!)
    if (trimmed === '!!') {
      inInstantBlock = !inInstantBlock;
      continue; // Don't include the marker line itself
    }

    const trimmedStart = line.trimStart();
    if (trimmedStart.startsWith('>')) {
      const command = trimmedStart.slice(1).trimStart();
      result.push({
        type: 'command',
        text: command,
        showPrompt: true,
        instant: false,
      });
    } else {
      result.push({
        type: 'output',
        text: line,
        showPrompt: false,
        instant: inInstantBlock,
      });
    }
  }

  return result;
}

export function generateAnimationFrames(parsedLines, config, theme, options = {}) {
  const {
    targetFrameCount = 40,
    typingSpeed = 50,
    targetWidth = null,
    targetHeight = null,
  } = options;

  const scale = 2;
  const frames = [];
  const outputMode = config.outputMode || 'typing';

  // Calculate final terminal dimensions based on ALL content (stays fixed throughout)
  const finalLines = parsedLines.map(l => ({
    text: l.text,
    showPrompt: l.showPrompt,
  }));

  // Determine canvas dimensions
  const useTargetDimensions = targetWidth && targetHeight;
  const canvasWidth = useTargetDimensions ? targetWidth * scale : null;
  const canvasHeight = useTargetDimensions ? targetHeight * scale : null;

  // Auto-scale font if content doesn't fit in fixed dimensions
  let adjustedConfig = { ...config };
  if (useTargetDimensions) {
    const terminalDims = calculateCanvasDimensions(config, theme, finalLines, scale);

    // Calculate scale factors needed to fit
    const widthRatio = canvasWidth / terminalDims.width;
    const heightRatio = canvasHeight / terminalDims.height;
    const fitRatio = Math.min(widthRatio, heightRatio);

    // Only scale down, never up - and set minimum font size
    if (fitRatio < 1) {
      const minFontSize = 8;
      const newFontSize = Math.max(minFontSize, Math.floor(config.fontSize * fitRatio));
      const newPadding = Math.max(8, Math.floor(config.padding * fitRatio));

      adjustedConfig = {
        ...config,
        fontSize: newFontSize,
        padding: newPadding,
      };
    }
  }

  // Recalculate dimensions with adjusted config if no target dimensions
  let finalCanvasWidth, finalCanvasHeight;
  if (useTargetDimensions) {
    finalCanvasWidth = canvasWidth;
    finalCanvasHeight = canvasHeight;
  } else {
    const dims = calculateCanvasDimensions(adjustedConfig, theme, finalLines, scale);
    finalCanvasWidth = dims.width;
    finalCanvasHeight = dims.height;
  }

  // Calculate typed chars, excluding instant lines (both from outputMode and !! markers)
  const typedChars = parsedLines.reduce((sum, l) => {
    // Skip instant output lines (either from global outputMode or !! markers)
    if ((outputMode === 'instant' && !l.showPrompt) || l.instant) return sum;
    return sum + l.text.length;
  }, 0);
  const charsPerFrame = Math.max(1, Math.ceil(typedChars / targetFrameCount));

  // Helper to create a frame with consistent dimensions (using adjusted config for font scaling)
  const createFrame = (lines, cursorLineIndex, delay) => ({
    canvas: createTerminalCanvas(adjustedConfig, theme, {
      lines,
      showCursor: true,
      cursorLineIndex,
    }, {
      scale,
      fixedWidth: finalCanvasWidth,
      fixedHeight: finalCanvasHeight,
    }),
    delay,
  });

  // Initial empty frame
  frames.push(createFrame([], 0, 500));

  const displayLines = [];
  let charCounter = 0;
  let lineIdx = 0;

  while (lineIdx < parsedLines.length) {
    const lineInfo = parsedLines[lineIdx];
    const fullText = lineInfo.text;
    const isCommand = lineInfo.showPrompt;
    // Check if this line should appear instantly (either from outputMode or !! marker)
    const shouldBeInstant = (outputMode === 'instant' && !isCommand) || lineInfo.instant;

    displayLines[lineIdx] = {
      text: '',
      showPrompt: lineInfo.showPrompt,
    };

    if (shouldBeInstant) {
      // Instant output - show immediately and batch consecutive instant lines
      displayLines[lineIdx].text = fullText;

      let batchEndIdx = lineIdx;
      // Batch consecutive instant lines together
      while (batchEndIdx + 1 < parsedLines.length) {
        const nextLine = parsedLines[batchEndIdx + 1];
        const nextIsInstant = (outputMode === 'instant' && !nextLine.showPrompt) || nextLine.instant;
        if (!nextIsInstant) break;

        batchEndIdx++;
        displayLines[batchEndIdx] = {
          text: parsedLines[batchEndIdx].text,
          showPrompt: parsedLines[batchEndIdx].showPrompt,
        };
      }

      const outputLineCount = batchEndIdx - lineIdx + 1;
      const baseDelay = 150;
      const perLineDelay = Math.min(50, 200 / outputLineCount);
      const totalDelay = baseDelay + (outputLineCount * perLineDelay);

      frames.push(createFrame(
        displayLines.map(l => ({ ...l })),
        batchEndIdx,
        Math.min(totalDelay, 400)
      ));

      lineIdx = batchEndIdx + 1;
    } else {
      // Typing animation for commands and non-instant output
      for (let charIdx = 0; charIdx < fullText.length; charIdx++) {
        displayLines[lineIdx].text = fullText.substring(0, charIdx + 1);
        charCounter++;

        if (charCounter % charsPerFrame === 0 || charIdx === fullText.length - 1) {
          frames.push(createFrame(
            displayLines.map(l => ({ ...l })),
            lineIdx,
            Math.max(30, typingSpeed)
          ));
        }
      }
      lineIdx++;
    }

    if (lineIdx < parsedLines.length) {
      frames.push(createFrame(
        displayLines.map(l => ({ ...l })),
        lineIdx,
        150
      ));
    }
  }

  // Final frame with cursor on new line
  frames.push(createFrame(
    displayLines.map(l => ({ ...l })),
    parsedLines.length,
    2000
  ));

  return frames;
}
