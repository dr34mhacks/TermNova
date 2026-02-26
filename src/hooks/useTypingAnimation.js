import { useState, useEffect, useCallback, useRef } from 'react';

export function useMultiLineTyping(lines, speed = 50, lineDelay = 300, enabled = true, options = {}) {
  const { outputMode = 'typing', lineInfo = null } = options;

  const [displayedLines, setDisplayedLines] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  const animationRef = useRef(null);

  const reset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setDisplayedLines([]);
    setCurrentLineIndex(0);
    setIsComplete(false);
  }, []);

  const skipToEnd = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setDisplayedLines(lines.map(line => ({ text: line, complete: true })));
    setCurrentLineIndex(lines.length);
    setIsComplete(true);
  }, [lines]);

  useEffect(() => {
    // Clean up on unmount or when dependencies change
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // If not enabled, show all text immediately
    if (!enabled) {
      if (lines.length === 0) {
        setDisplayedLines([]);
      }
      setIsComplete(true);
      return;
    }

    // Handle empty lines
    if (lines.length === 0) {
      setDisplayedLines([]);
      setIsComplete(true);
      return;
    }

    // Check if a line should be typed or shown instantly
    const shouldTypeLine = (idx) => {
      if (outputMode !== 'instant') return true;
      // In instant mode, only type commands (lines with prompts)
      if (lineInfo && lineInfo[idx]) {
        return lineInfo[idx].showPrompt;
      }
      return true;
    };

    // Animation state tracked with refs to avoid closure issues
    let lineIdx = 0;
    let charIdx = 0;
    let lastTime = 0;
    let waitingForNextLine = false;
    let waitStartTime = 0;

    const animate = (timestamp) => {
      if (!lastTime) lastTime = timestamp;

      const elapsed = timestamp - lastTime;

      // Check if we're waiting between lines
      if (waitingForNextLine) {
        if (timestamp - waitStartTime >= lineDelay) {
          waitingForNextLine = false;
          lineIdx++;
          charIdx = 0;
          setCurrentLineIndex(lineIdx);
          lastTime = timestamp;
        }
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // Check if we're done
      if (lineIdx >= lines.length) {
        setIsComplete(true);
        return;
      }

      const currentLine = lines[lineIdx];
      const typeThisLine = shouldTypeLine(lineIdx);

      // If instant mode for this line, show it all at once
      if (!typeThisLine) {
        setDisplayedLines(prev => {
          const newLines = [...prev];
          newLines[lineIdx] = {
            text: currentLine,
            complete: true
          };
          return newLines;
        });

        // Move to next line
        if (lineIdx < lines.length - 1) {
          waitingForNextLine = true;
          waitStartTime = timestamp;
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsComplete(true);
        }
        return;
      }

      // Check if enough time has passed for next character
      if (elapsed < speed) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      lastTime = timestamp;

      // Type next character
      if (charIdx < currentLine.length) {
        charIdx++;

        setDisplayedLines(prev => {
          const newLines = [...prev];
          newLines[lineIdx] = {
            text: currentLine.substring(0, charIdx),
            complete: false
          };
          return newLines;
        });

        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Line complete
        setDisplayedLines(prev => {
          const newLines = [...prev];
          newLines[lineIdx] = {
            text: currentLine,
            complete: true
          };
          return newLines;
        });

        // Check if there are more lines
        if (lineIdx < lines.length - 1) {
          waitingForNextLine = true;
          waitStartTime = timestamp;
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // All done
          setIsComplete(true);
        }
      }
    };

    // Start animation
    setDisplayedLines([]);
    setCurrentLineIndex(0);
    setIsComplete(false);
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, lines, speed, lineDelay, outputMode, lineInfo]);

  const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
  const typedChars = displayedLines.reduce((sum, line) => sum + (line?.text?.length || 0), 0);
  const progress = totalChars > 0 ? typedChars / totalChars : 0;

  return {
    displayedLines,
    isComplete,
    reset,
    skipToEnd,
    progress,
    currentLineIndex
  };
}
