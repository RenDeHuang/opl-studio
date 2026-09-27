import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event: {error: string}) => void) | null; onend: (() => void) | null };
export function voiceRecognitionProvider(): (new () => Recognition) | undefined { const scope = globalThis as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }; return scope.SpeechRecognition ?? scope.webkitSpeechRecognition; }
export function VoiceInput({ locale, onTranscript }: { locale: 'zh' | 'en'; onTranscript(text: string): void }) {
 const onTranscriptRef = useRef(onTranscript); onTranscriptRef.current = onTranscript;
 const ref = useRef<Recognition | null>(null); const [recording, setRecording] = useState(false); const [error, setError] = useState(''); const zh = locale === 'zh';
 useEffect(() => () => { if (ref.current) { ref.current.onresult = null; ref.current.onend = null; ref.current.onerror = null; ref.current.abort(); } }, []);
 if (!voiceRecognitionProvider()) return null;
 function toggle() { if (recording) {ref.current?.stop();return;} const Provider = voiceRecognitionProvider(); if (!Provider) return; const recognition = new Provider(); ref.current = recognition; recognition.lang = zh ? 'zh-CN' : 'en-US'; recognition.continuous = false; recognition.interimResults = false; recognition.onresult = event => { const text = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(''); if (text) onTranscriptRef.current(text); }; recognition.onend = () => setRecording(false); recognition.onerror = event => {setRecording(false);setError(event.error === 'not-allowed' ? (zh ? '请允许麦克风访问后重试。' : 'Allow microphone access and retry.') : (zh ? '听写未完成，请检查麦克风与网络后重试。' : 'Dictation failed. Check your microphone and connection, then retry.'));}; try {recognition.start();setRecording(true);setError('');} catch {setError(zh ? '无法启动麦克风，请检查权限。' : 'Cannot start microphone. Check permissions.');} }
 return <><Button aria-label={recording ? (zh ? '停止听写' : 'Stop dictation') : (zh ? '语音输入' : 'Voice input')} aria-pressed={recording} onClick={toggle}>{recording ? <Square size={14}/> : <Mic size={14}/>}</Button>{error && <span role="alert">{error}</span>}</>;
}
