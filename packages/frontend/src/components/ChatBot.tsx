import React, { useState, useRef, useEffect } from 'react';
import { Box, TextField, Button, Typography, CircularProgress, IconButton, Popover, List, ListItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import ImageIcon from '@mui/icons-material/Image';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CodeIcon from '@mui/icons-material/Code';
import StorageIcon from '@mui/icons-material/Storage';
import FavoriteIcon from '@mui/icons-material/Favorite';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { CommunicationsManager } from 'communications-manager';
import { WebSocketManager } from "../services/WebsocketManager";
import { AudioPlayer } from './AudioPlayer';
import MermaidDiagram from './MermaidDiagram';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { lucario } from 'react-syntax-highlighter/dist/esm/styles/prism';

import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';

SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('yaml', yaml);

interface Message {
  text: string;
  image?: string;
  audio?: string;
  diagram?: string;
  code?: string;
  language?: string;
  isBot: boolean;
  isError?: boolean;
  isLoading?: boolean;
  choice?: string[];
  timestamp: Date;
}

const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const commsManagerRef = useRef<CommunicationsManager | null>(null);
  const isInitialConnectionRef = useRef(true);

  const LoadingIndicator = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <CircularProgress size={20} />
      <Typography variant="body2">writing...</Typography>
    </Box>
  );

  useEffect(() => {
    commsManagerRef.current = WebSocketManager.getCommsManager("AskTheExpert");

    const handleOpen = () => {
      if (isInitialConnectionRef.current) {
        console.log("WebSocket connection established");
        setMessages(prev => [...prev, { text: "Hello there...", isBot: true, timestamp: new Date() }]);
        isInitialConnectionRef.current = false;
      }
    };

    const handleError = (error: any) => {
      console.error("Error connecting to bot server: ", error);
      const errorMessage = formatError(error);
      setMessages(prev => [
        ...prev,
        {
          text: `There was a problem connecting to the bot server: ${errorMessage}`,
          isBot: true,
          isError: true,
          timestamp: new Date()
        }
      ]);
    };

    if (commsManagerRef.current) {
      commsManagerRef.current.removeAllListeners('open');
      commsManagerRef.current.removeAllListeners('error');
      commsManagerRef.current.removeAllListeners('RELAY');

      commsManagerRef.current.onOpen(handleOpen);
      commsManagerRef.current.onError(handleError);
      commsManagerRef.current.onRequest("RELAY", handleIncomingMessages);
    }

    return () => {
      if (commsManagerRef.current) {
        commsManagerRef.current.removeListener('open', handleOpen);
        commsManagerRef.current.removeListener('error', handleError);
        commsManagerRef.current.removeListener('RELAY', handleIncomingMessages);
      }
    };
  }, []);

  const formatError = (error: any): string => {
    if (error instanceof Event) {
      return "Network error occurred";
    }
    return error.message || "Unknown error occurred";
  };

  const handleHelpOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleHelpClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'help-popover' : undefined;

  const handleIncomingMessages = (newMessages: Message[]) => {
    console.log("Request Messages: ", newMessages);
    if (!Array.isArray(newMessages)) {
      newMessages = JSON.parse(newMessages);
    }
    setMessages(prev => {
      const updatedMessages = [...prev];
      const loadingIndex = updatedMessages.findIndex(msg => msg.isLoading);
      if (loadingIndex !== -1) {
        updatedMessages.splice(loadingIndex, 1);
      }
      return [...updatedMessages, ...newMessages.map(msg => ({
        ...msg,
        isBot: true,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
      }))];
    });
    setIsWaiting(false);
  };

  const handleSend = () => {
    if (input.trim() !== '' && commsManagerRef.current) {
      const userMessage: Message = { text: input, isBot: false, timestamp: new Date() };
      setMessages(prev => [...prev, userMessage]);
      setIsWaiting(true);
      setMessages(prev => [...prev, { text: '...', isBot: true, isLoading: true, timestamp: new Date() }]);
      commsManagerRef.current.request<{ text: string }, Message[]>("message", { text: input }, "chatbot")
        .then((response) => {
          if (response.success) {
            console.log(response.data);
            handleIncomingMessages(response.data);
          } else {
            console.error(response.data);
            const errorMessage = formatError(response.error || 'Unexpected response format');
            setMessages(prev => {
              const newMessages = prev.filter(msg => !msg.isLoading);
              return [...newMessages, { text: `Error: ${errorMessage}`, isBot: true, isError: true, timestamp: new Date() }];
            });
          }
        })
        .catch((error) => {
          const errorMessage = formatError(error);
          setMessages(prev => {
            const newMessages = prev.filter(msg => !msg.isLoading);
            return [...newMessages, { text: `Error: ${errorMessage}`, isBot: true, isError: true, timestamp: new Date() }];
          });
        })
        .finally(() => {
          setIsWaiting(false);
        });
      setInput('');
    }
  };

  const handleChoice = (choiceText: string) => {
    if (commsManagerRef.current) {
      const userMessage: Message = { text: choiceText, isBot: false, timestamp: new Date() };
      setMessages(prev => [...prev, userMessage]);
      setIsWaiting(true);
      setMessages(prev => [...prev, { text: '...', isBot: true, isLoading: true, timestamp: new Date() }]);

      commsManagerRef.current.request<{ text: string }, Message[]>("message", { text: choiceText }, "chatbot")
        .then((response) => {
          if (response.success) {
            handleIncomingMessages(response.data);
          } else {
            const errorMessage = formatError(response.error || 'Unexpected response format');
            setMessages(prev => {
              const newMessages = prev.filter(msg => !msg.isLoading);
              return [...newMessages, { text: `Error: ${errorMessage}`, isBot: true, isError: true, timestamp: new Date() }];
            });
          }
        })
        .catch((error) => {
          const errorMessage = formatError(error);
          setMessages(prev => {
            const newMessages = prev.filter(msg => !msg.isLoading);
            return [...newMessages, { text: `Error: ${errorMessage}`, isBot: true, isError: true, timestamp: new Date() }];
          });
        })
        .finally(() => {
          setIsWaiting(false);
        });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        bgcolor: '#f2f3f3',
        fontFamily: "'Amazon Ember', 'Helvetica Neue', Roboto, Arial, sans-serif",
      }}
    >
      <Box
        sx={{
          width: '90%',
          maxWidth: 1000,
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}
      >
        <IconButton
          aria-describedby={id}
          onClick={handleHelpOpen}
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            bgcolor: '#ff9900',
            color: '#fff',
            '&:hover': {
              bgcolor: '#e88b00',
            },
          }}
        >
          <HelpIcon />
        </IconButton>

        <Popover
          id={id}
          open={open}
          anchorEl={anchorEl}
          onClose={handleHelpClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          PaperProps={{
            sx: {
              width: 550,
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }
          }}
        >
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ color: '#232f3e', fontWeight: 'bold' }}>
              How to Use SAGE
            </Typography>
            <Typography variant="body2" paragraph sx={{ color: '#545b64' }}>
              Ask any question you would ask an AWS Solutions Architect.
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom sx={{ color: '#232f3e', fontWeight: 'medium' }}>
             Sage's abilities:
            </Typography>
            <List sx={{ mt: 2 }}>
            <ListItem disablePadding>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <ImageIcon sx={{ color: '#ff9900' }} />
              </ListItemIcon>
                <ListItemText 
                  primary="Image Generation"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <AudiotrackIcon sx={{ color: '#ff9900' }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Audio Responses"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <AccountTreeIcon sx={{ color: '#ff9900' }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Architecture Diagrams"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CodeIcon sx={{ color: '#ff9900' }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Code Samples"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <StorageIcon sx={{ color: '#ff9900' }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Store/Retrieve Conversations"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
            </List>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom sx={{ color: '#232f3e', fontWeight: 'medium' }}>
              Example Prompts:
            </Typography>
            <List>
              <ListItem disablePadding>
                <ListItemText 
                  primary="- Please generate an architecture diagram for a Datalake"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemText 
                  primary="- Create a CDK code sample for deploying an ECS Cluster"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemText 
                  primary="- Send me an audio explaining Amazon Kinesis"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemText 
                  primary="- What is your architecture?"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemText 
                  primary="- Simulate a Solutions Architect Associate AWS Certification question"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemText 
                  primary="- Who Built you?"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemText 
                  primary="- Can you send me an image of an Amazon building?"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
              <ListItem disablePadding>
                <ListItemText 
                  primary="- Please store our conversation with the id: sage_is_the_best"
                  primaryTypographyProps={{ color: '#545b64' }}
                />
              </ListItem>
            </List>
          </Box>
        </Popover>
        <Box
          sx={{
            bgcolor: '#232f3e', // AWS dark blue
            color: '#ffffff', // White text for better contrast
            p: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <SmartToyIcon sx={{ fontSize: 32, mr: 2, color: '#ff9900' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
            AWS SAGE (Solutions Architect GenAI Engine)
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3, bgcolor: '#ffffff' }}>
          {messages.map((message, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                justifyContent: message.isBot ? 'flex-start' : 'flex-end',
                mb: 2,
                width: '100%',
              }}
            >
              <Box
                sx={{
                  minWidth: message.diagram || message.code ? '100%' : '250px',
                  maxWidth: message.diagram || message.code ? '100%' : '70%',
                  p: 2,
                  borderRadius: '8px',
                  bgcolor: message.isBot
                    ? (message.isError ? '#ffd9d9' : '#f1faff')
                    : '#feebda',
                  color: '#16191f',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <Typography variant="body1" sx={{ mb: 1, fontWeight: 'bold' }}>
                  {message.isBot ? 'SAGE' : 'You'}
                </Typography>
                {message.isLoading ? (
                  <LoadingIndicator />
                ) : (
                  <Typography
                    variant="body1"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {message.text.replace(/\\n/g, '\n')}
                  </Typography>
                )}
                {message.image && (
                  <img
                    src={message.image}
                    alt="Content sent by bot"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 400,
                      objectFit: 'contain',
                      marginTop: '8px',
                      borderRadius: '4px',
                    }}
                  />
                )}
                {message.audio && (
                  <AudioPlayer key={message.audio} audioUrl={message.audio} />
                )}
                {message.choice && (
                  <Box sx={{ mt: 2 }}>
                    {message.choice.map((option, idx) => (
                      <Button
                        key={idx}
                        onClick={() => handleChoice(option)}
                        variant="outlined"
                        size="small"
                        sx={{
                          mr: 1,
                          mb: 1,
                          color: '#232f3e',
                          borderColor: '#232f3e',
                          '&:hover': {
                            bgcolor: '#232f3e',
                            color: '#fff',
                          },
                        }}
                      >
                        {option}
                      </Button>
                    ))}
                  </Box>
                )}
                {message.diagram && (
                  <Box sx={{ mt: 2, width: '100%', overflowX: 'auto' }}>
                    <MermaidDiagram chart={message.diagram} />
                  </Box>
                )}
                {message.code && (
                  <Box sx={{ mt: 2, fontSize: '0.9em' }}>
                    <SyntaxHighlighter
                      language={message.language || 'javascript'}
                      style={lucario}
                      customStyle={{
                        padding: '1em',
                        borderRadius: '4px',
                        maxHeight: '400px',
                        overflowY: 'auto'
                      }}
                    >
                      {message.code}
                    </SyntaxHighlighter>
                  </Box>
                )}
              </Box>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>
        <Box sx={{ p: 2, bgcolor: '#f2f3f3' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Type a message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isWaiting && handleSend()}
              sx={{
                mr: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '4px',
                  bgcolor: 'white',
                  '& fieldset': {
                    borderColor: '#232f3e',
                  },
                  '&:hover fieldset': {
                    borderColor: '#ff9900',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#ff9900',
                  },
                },
              }}
            />
            <Button
              onClick={handleSend}
              disabled={isWaiting}
              sx={{
                bgcolor: '#ff9900',
                color: '#fff',
                borderRadius: '4px',
                minWidth: '56px',
                height: '56px',
                p: 0,
                '&:hover': {
                  bgcolor: '#e88b00',
                },
              }}
            >
              <SendIcon />
            </Button>
          </Box>
        </Box>
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            color: 'grey.500',
            fontSize: '0.75rem',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ mr: 0.5 }}>
              Built with
            </Typography>
            <FavoriteIcon sx={{ fontSize: '0.75rem', color: 'grey.500' }} />
            <Typography variant="caption" sx={{ ml: 0.5 }}>
              by Adler Oliveira
            </Typography>
          </Box>
          <Typography variant="caption">
            Principal Solutions Architect (santoliv@amazon.com)
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatBot;