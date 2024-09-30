import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

export const AudioPlayer: React.FC<{ audioUrl: string }> = React.memo(({ audioUrl }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
  
    const togglePlay = useCallback(() => {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    }, [isPlaying]);
  
    useEffect(() => {
      const audio = audioRef.current;
      const handleEnded = () => setIsPlaying(false);
  
      if (audio) {
        audio.addEventListener('ended', handleEnded);
      }
  
      return () => {
        if (audio) {
          audio.removeEventListener('ended', handleEnded);
        }
      };
    }, []);
  
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
        <IconButton onClick={togglePlay}>
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <Typography variant="caption">
          {isPlaying ? 'Playing audio...' : 'Play audio'}
        </Typography>
        <audio ref={audioRef} src={audioUrl} />
      </Box>
    );
  });