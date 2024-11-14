'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as Tone from 'tone';

// Expanded keyboard mapping for a proper piano layout
const KEY_TO_NOTE: { [key: string]: string } = {
  // Lower octave
  z: 'C3', s: 'C#3', x: 'D3', d: 'D#3', c: 'E3', v: 'F3', g: 'F#3', b: 'G3', h: 'G#3', n: 'A3', j: 'A#3', m: 'B3',
  // Upper octave
  q: 'C4', 2: 'C#4', w: 'D4', 3: 'D#4', e: 'E4', r: 'F4', 5: 'F#4', t: 'G4', 6: 'G#4', y: 'A4', 7: 'A#4', u: 'B4',
  i: 'C5', 9: 'C#5', o: 'D5', 0: 'D#5', p: 'E5', '[': 'F5', '=': 'F#5', ']': 'G5'
};

// Mapping color prop to Tailwind classes
const COLOR_CLASSES: { [key: string]: string } = {
  green: 'green-400',
  blue: 'blue-400',
  purple: 'purple-400',
  yellow: 'yellow-400',
  red: 'red-400',
  gray: 'gray-400',
};

// Knob Component with improved dynamic styling and accessibility
interface KnobProps {
  label: string;
  min?: number;
  max?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  color?: keyof typeof COLOR_CLASSES;
}

const Knob = ({ value, onChange, label, min = 0, max = 100, color = 'green' }) => {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-16 rounded-full relative"
           style={{
             background: 'linear-gradient(145deg, #1a1a1a, #2a2a2a)',
             boxShadow: '3px 3px 5px rgba(0,0,0,0.5), -3px -3px 5px rgba(255,255,255,0.05)',
             border: `1px solid rgba(0, 255, 0, 0.2)`
           }}>
        <div
          className="absolute w-1 h-8"
          style={{
            backgroundColor: `var(--${color})`,
            left: '50%',
            bottom: '50%',
            transformOrigin: 'bottom center',
            transform: `translateX(-50%) rotate(${((value - min) / (max - min)) * 270 - 135}deg)`,
            borderRadius: '1px',
            boxShadow: `0 0 5px var(--${color})`
          }}
        />
      </div>
      <div className={`text-${color}-500 text-sm font-medium`}>{label}</div>
      <div className={`text-${color}-500/80 text-xs`}>{value}</div>
    </div>
  )
}

// PianoKey Component with improved accessibility and styling
interface PianoKeyProps {
  note: string;
  isSharp?: boolean;
  activeNotes: Set<string>;
  synth: Tone.PolySynth | null;
  setActiveNotes: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  isRecording: boolean;
  startTimeRef: React.RefObject<number | null>;
  setRecordedNotes: (value: Array<{ note: string; time: number; }> | ((prev: Array<{ note: string; time: number; }> ) => Array<{ note: string; time: number; }>)) => void;
}

const PianoKey: React.FC<PianoKeyProps> = ({ 
  note, 
  isSharp = false,
  activeNotes,
  synth,
  setActiveNotes,
  isRecording,
  startTimeRef,
  setRecordedNotes
}) => {
  const isActive = activeNotes.has(note);
  
  const handleMouseDown = () => {
    synth?.triggerAttack(note);
    setActiveNotes(prev => new Set(prev).add(note));
    if (isRecording && startTimeRef.current !== null) {
      const currentTime = Tone.now() - startTimeRef.current;
      setRecordedNotes(prev => [...prev, { note, time: currentTime }]);
    }
  };

  const handleMouseUp = () => {
    synth?.triggerRelease(note);
    setActiveNotes(prev => {
      const newNotes = new Set(prev);
      newNotes.delete(note);
      return newNotes;
    });
  };

  return (
    <Button
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => isActive && handleMouseUp()}
      className={`
        ${isSharp ? 
          'w-5 h-24 -mx-2.5 z-10 bg-gray-800 hover:bg-gray-700' : 
          'w-8 h-36 bg-gray-200 hover:bg-gray-100'
        }
        ${isActive ? 'shadow-lg shadow-green-400/30 scale-[0.98] translate-y-1' : ''}
        relative
        rounded-b-lg
        transition-all
        duration-150
        flex
        flex-col
        justify-end
        pb-2
        items-center
        text-[10px]
        font-medium
        ${isSharp ? 'text-green-400' : 'text-gray-600'}
        border-x border-b border-gray-300
        shadow-md
        ${isSharp ? 'shadow-gray-900/50' : 'shadow-gray-400/30'}
      `}
      aria-label={`Piano key ${note}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleMouseDown();
        }
      }}
    >
      {note}
    </Button>
  );
};

// Main Component
export default function SYNTHBRO() {
  const [synth, setSynth] = useState<Tone.PolySynth | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNotes, setActiveNotes] = useState(new Set<string>());
  const [isRecording, setIsRecording] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState<Array<{ note: string, time: number }>>([]);
  const [recorder, setRecorder] = useState<Tone.Recorder | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const frequencyCanvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef<Tone.Analyser | null>(null);

  // New state for added features
  const [reverb, setReverb] = useState<Tone.Reverb | null>(null);
  const [delay, setDelay] = useState<Tone.FeedbackDelay | null>(null);
  const [distortion, setDistortion] = useState<Tone.Distortion | null>(null);
  const [isArpeggiatorActive, setArpeggiatorActive] = useState(false);
  const [arpeggiatorId, setArpeggiatorId] = useState<number | null>(null);
  const [sequence, setSequence] = useState([
    { note: 'C4', time: '0:0:0', active: false },
    { note: 'D4', time: '0:0:1', active: false },
    { note: 'E4', time: '0:1:0', active: false },
    { note: 'F4', time: '0:1:1', active: false },
  ]);
  const [isMetronomeActive, setMetronomeActive] = useState(false);
  const [metronomeId, setMetronomeId] = useState<number | null>(null);
  const [sample, setSample] = useState<Tone.Player | null>(null);

  // Initialize synth, recorder, analyzer, and effects
  useEffect(() => {
    const newSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8 },
    });

    const newReverb = new Tone.Reverb(2).toDestination();
    const newDelay = new Tone.FeedbackDelay(0.5, 0.5).toDestination();
    const newDistortion = new Tone.Distortion(0.5).toDestination();
    const newAnalyzer = new Tone.Analyser('waveform', 256);

    newSynth.chain(newReverb, newDelay, newDistortion, newAnalyzer, Tone.Destination);

    setSynth(newSynth);
    setReverb(newReverb);
    setDelay(newDelay);
    setDistortion(newDistortion);
    analyzerRef.current = newAnalyzer;

    const newRecorder = new Tone.Recorder();
    newSynth.connect(newRecorder);
    setRecorder(newRecorder);

    return () => {
      newSynth.dispose();
      newReverb.dispose();
      newDelay.dispose();
      newDistortion.dispose();
      newAnalyzer.dispose();
      newRecorder.dispose();
    };
  }, []);

  // Visualizer
  useEffect(() => {
    if (!waveformCanvasRef.current || !frequencyCanvasRef.current || !analyzerRef.current) return;

    const waveformCanvas = waveformCanvasRef.current;
    const frequencyCanvas = frequencyCanvasRef.current;
    const waveformCtx = waveformCanvas.getContext('2d');
    const frequencyCtx = frequencyCanvas.getContext('2d');
    if (!waveformCtx || !frequencyCtx) return;

    const drawVisualizer = () => {
      requestAnimationFrame(drawVisualizer);

      const bufferLength = analyzerRef.current!.size;
      const dataArray = analyzerRef.current!.getValue();

      // Waveform
      waveformCtx.fillStyle = 'rgb(20, 20, 20)';
      waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

      waveformCtx.lineWidth = 2;
      waveformCtx.strokeStyle = 'rgb(74, 222, 128)';
      waveformCtx.beginPath();

      const waveformSliceWidth = (waveformCanvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] as number;
        const y = (v * waveformCanvas.height) / 2 + waveformCanvas.height / 2;

        if (i === 0) {
          waveformCtx.moveTo(x, y);
        } else {
          waveformCtx.lineTo(x, y);
        }

        x += waveformSliceWidth;
      }

      waveformCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
      waveformCtx.stroke();

      // Frequency
      frequencyCtx.fillStyle = 'rgb(20, 20, 20)';
      frequencyCtx.fillRect(0, 0, frequencyCanvas.width, frequencyCanvas.height);

      const barWidth = (frequencyCanvas.width / bufferLength) * 2.5;
      let barHeight;
      let x1 = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = Math.abs(dataArray[i] as number) * frequencyCanvas.height;

        const r = barHeight + 25 * (i / bufferLength);
        const g = 250 * (i / bufferLength);
        const b = 50;

        frequencyCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        frequencyCtx.fillRect(x1, frequencyCanvas.height - barHeight, barWidth, barHeight);

        x1 += barWidth + 1;
      }
    };

    drawVisualizer();
  }, []);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const note = KEY_TO_NOTE[e.key.toLowerCase()];
      if (note && !activeNotes.has(note) && synth) {
        setActiveNotes(prev => new Set(prev).add(note));
        synth.triggerAttack(note);
        if (isRecording && startTimeRef.current !== null) {
          const currentTime = Tone.now() - startTimeRef.current;
          setRecordedNotes(prev => [...prev, { note, time: currentTime }]);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const note = KEY_TO_NOTE[e.key.toLowerCase()];
      if (note && synth) {
        setActiveNotes(prev => {
          const newNotes = new Set(prev);
          newNotes.delete(note);
          return newNotes;
        });
        synth.triggerRelease(note);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [synth, activeNotes, isRecording]);

  const toggleSynth = async () => {
    if (isPlaying) {
      Tone.Transport.stop();
      synth?.releaseAll();
    } else {
      await Tone.start();
      Tone.Transport.start();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      await Tone.start();
      recorder?.start();
      startTimeRef.current = Tone.now();
      setRecordedNotes([]);
    } else {
      const recording = await recorder?.stop();
      if (recording) {
        const url = URL.createObjectURL(recording);
        const anchor = document.createElement('a');
        anchor.download = 'synthbro-recording.webm';
        anchor.href = url;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    }
    setIsRecording(!isRecording);
  };

  const playRecording = () => {
    if (synth) {
      recordedNotes.forEach(({ note, time }) => {
        synth.triggerAttackRelease(note, '8n', Tone.now() + time);
      });
    }
  };

  // New functions for added features
  const changeOscillatorType = (type: Tone.ToneOscillatorType) => {
    synth?.set({
      oscillator: {
        type: type as any // This is a workaround for the Tone.js type issue
      }
    });
  };

  const toggleArpeggiator = () => {
    if (isArpeggiatorActive) {
      Tone.Transport.clear(arpeggiatorId!);
      setArpeggiatorId(null);
    } else {
      const id = Tone.Transport.scheduleRepeat((time) => {
        const notes = Array.from(activeNotes);
        if (notes.length > 0) {
          const note = notes[Math.floor(Math.random() * notes.length)];
          synth?.triggerAttackRelease(note, '16n', time);
        }
      }, '16n');
      setArpeggiatorId(id);
    }
    setArpeggiatorActive(!isArpeggiatorActive);
  };

  const toggleStep = (index: number) => {
    const updatedSequence = [...sequence];
    updatedSequence[index].active = !updatedSequence[index].active;
    setSequence(updatedSequence);
  };

  useEffect(() => {
    const synthPart = new Tone.Part((time, { note, active }) => {
      if (active) synth?.triggerAttackRelease(note, '8n', time);
    }, sequence).start(0);

    // Return a cleanup function that disposes of the Part
    return () => {
      synthPart.dispose();
    };
  }, [sequence, synth]);

  const savePreset = () => {
    try {
      const preset = {
        volume: synth?.volume.value,
        oscillatorType: synth?.get().oscillator.type,
        reverbWet: reverb?.wet.value,
        delayWet: delay?.wet.value,
        distortionWet: distortion?.wet.value,
      };
      localStorage.setItem('synthPreset', JSON.stringify(preset));
      alert('Preset saved successfully!');
    } catch (error) {
      console.error('Error saving preset:', error);
      alert('Failed to save preset.');
    }
  };

  const loadPreset = () => {
    try {
      const preset = JSON.parse(localStorage.getItem('synthPreset') || '{}');
      if (Object.keys(preset).length === 0) {
        alert('No preset found.');
        return;
      }
      synth?.set({
        volume: preset.volume,
        oscillator: { type: preset.oscillatorType },
      });
      if (reverb) reverb.wet.value = preset.reverbWet;
      if (delay) delay.wet.value = preset.delayWet;
      if (distortion) distortion.wet.value = preset.distortionWet;
      alert('Preset loaded successfully!');
    } catch (error) {
      console.error('Error loading preset:', error);
      alert('Failed to load preset.');
    }
  };

  const changeTempo = (newTempo: number) => {
    Tone.Transport.bpm.value = newTempo;
  };

  const toggleMetronome = () => {
    if (isMetronomeActive) {
      Tone.Transport.clear(metronomeId!);
      setMetronomeId(null);
    } else {
      const metronome = new Tone.Player("https://tonejs.github.io/audio/berklee/click1.mp3").toDestination();
      const id = Tone.Transport.scheduleRepeat((time) => {
        metronome.start(time);
      }, "4n");
      setMetronomeId(id);
    }
    setMetronomeActive(!isMetronomeActive);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const samplePlayer = new Tone.Player(url).toDestination();
      setSample(samplePlayer);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8 flex items-center justify-center">
      <div className="bg-gray-900 p-8 rounded-3xl shadow-2xl space-y-8 max-w-7xl w-full
        border border-gray-800 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>
            <h2 className="text-6xl font-bold tracking-wider bg-gradient-to-r from-green-400 to-blue-500 
              bg-clip-text text-transparent drop-shadow-lg" style={{
                fontFamily: '"Orbitron", sans-serif',
              }}>SYNTHBRO</h2>
            <p className="text-green-500/50 text-sm mt-1">Advanced Tone.js Synthesizer</p>
          </div>
          <div className="flex space-x-4 mt-4 md:mt-0">
            <Button
              onClick={toggleSynth}
              className={`
                px-8 py-4 rounded-full text-lg font-bold
                ${isPlaying ? 
                  'bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse' : 
                  'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                }
                backdrop-blur-xl
                transition-all duration-300
                shadow-lg
                ${isPlaying ? 'shadow-red-500/20' : 'shadow-green-500/20'}
              `}
              aria-pressed={isPlaying}
              aria-label={isPlaying ? 'Stop Synth' : 'Start Synth'}
            >
              {isPlaying ? 'Stop' : 'Start'}
            </Button>
            <Button
              onClick={toggleRecording}
              className={`
                px-8 py-4 rounded-full text-lg font-bold
                ${isRecording ? 
                  'bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse' : 
                  'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                }
                backdrop-blur-xl
                transition-all duration-300
                shadow-lg
                ${isRecording ? 'shadow-red-500/20' : 'shadow-blue-500/20'}
              `}
              aria-pressed={isRecording}
              aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Button>
            <Button
              onClick={playRecording}
              disabled={recordedNotes.length === 0}
              className={`
                px-8 py-4 rounded-full text-lg font-bold
                bg-purple-500/20 text-purple-400 hover:bg-purple-500/30
                backdrop-blur-xl
                transition-all duration-300
                shadow-lg shadow-purple-500/20
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              aria-disabled={recordedNotes.length === 0}
              aria-label="Play Recording"
            >
              Play Recording
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Oscillator Controls */}
          <div className="bg-gradient-to-b from-navy-900/90 to-black/90 p-6 rounded-xl border border-gray-700/50
            backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300">
            <h3 className="text-lg font-semibold text-green-400 mb-6">Oscillator</h3>
            <div className="flex justify-around flex-wrap">
              <Knob 
                label="Volume" 
                onChange={(value) => synth?.set({ volume: Tone.gainToDb(value / 100) })} 
              />
              <Knob 
                label="Detune" 
                min={-100} 
                max={100} 
                defaultValue={0}
                onChange={(value) => synth?.set({ detune: value })}
                color="blue"
              />
              <Knob 
                label="Portamento" 
                min={0}
                max={1}
                step={0.01}
                defaultValue={0}
                onChange={(value) => synth?.set({ portamento: value })}
                color="purple"
              />
            </div>
          </div>
          
          {/* Envelope Controls */}
          <div className="bg-gradient-to-b from-navy-900/90 to-black/90 p-6 rounded-xl border border-gray-700/50
            backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300">
            <h3 className="text-lg font-semibold text-green-400 mb-6">Envelope</h3>
            <div className="flex justify-around flex-wrap">
              <Knob 
                label="Attack" 
                min={0}
                max={2}
                step={0.01}
                defaultValue={0.1}
                onChange={(value) => synth?.set({ envelope: { attack: value } })}
              />
              <Knob 
                label="Decay" 
                min={0}
                max={2}
                step={0.01}
                defaultValue={0.2}
                onChange={(value) => synth?.set({ envelope: { decay: value } })}
                color="blue"
              />
              <Knob 
                label="Sustain" 
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.5}
                onChange={(value) => synth?.set({ envelope: { sustain: value } })}
                color="purple"
              />
              <Knob 
                label="Release" 
                min={0}
                max={5}
                step={0.01}
                defaultValue={0.8}
                onChange={(value) => synth?.set({ envelope: { release: value } })}
                color="yellow"
              />
            </div>
          </div>
          
          {/* Effects Controls */}
          <div className="bg-gradient-to-b from-navy-900/90 to-black/90 p-6 rounded-xl border border-gray-700/50
            backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300">
            <h3 className="text-lg font-semibold text-green-400 mb-6">Effects</h3>
            <div className="flex justify-around flex-wrap">
              <Knob 
                label="Reverb" 
                min={0}
                max={100}
                defaultValue={50}
                onChange={(value) => reverb?.set({ wet: value / 100 })}
                color="green"
              />
              <Knob 
                label="Delay" 
                min={0}
                max={100}
                defaultValue={50}
                onChange={(value) => delay?.set({ wet: value / 100 })}
                color="blue"
              />
              <Knob 
                label="Distortion" 
                min={0}
                max={100}
                defaultValue={50}
                onChange={(value) => distortion?.set({ wet: value / 100 })}
                color="purple"
              />
              <Knob
                label="Tempo"
                min={60}
                max={240}
                defaultValue={120}
                onChange={changeTempo}
                color="yellow"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Waveform Visualizer */}
          <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-xl shadow-xl">
            <h3 className="text-lg font-semibold text-green-400 mb-6">Waveform</h3>
            <canvas ref={waveformCanvasRef} width="512" height="200" className="w-full rounded-lg" aria-label="Waveform Visualizer" />
          </div>
          
          {/* Frequency Spectrum Visualizer */}
          <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-xl shadow-xl">
            <h3 className="text-lg font-semibold text-green-400 mb-6">Frequency Spectrum</h3>
            <canvas ref={frequencyCanvasRef} width="512" height="200" className="w-full rounded-lg" aria-label="Frequency Spectrum Visualizer" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Oscillator Type Selection */}
          <div className="bg-gradient-to-b from-navy-900/90 to-black/90 p-6 rounded-xl border border-gray-700/50
            backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300">
            <h3 className="text-lg font-semibold text-green-400 mb-6">Oscillator Type</h3>
            <Select onValueChange={changeOscillatorType}>
              <SelectTrigger className="w-full" aria-label="Select Oscillator Type">
                <SelectValue placeholder="Select oscillator type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sine">Sine</SelectItem>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="triangle">Triangle</SelectItem>
                <SelectItem value="sawtooth">Sawtooth</SelectItem>
                <SelectItem value="fatsine">Fat Sine</SelectItem>
                <SelectItem value="pwm">Pulse Width Modulation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Arpeggiator Control */}
          <div className="bg-gradient-to-b from-navy-900/90 to-black/90 p-6 rounded-xl border border-gray-700/50
            backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col items-center">
            <h3 className="text-lg font-semibold text-green-400 mb-6">Arpeggiator</h3>
            <Button
              onClick={toggleArpeggiator}
              className={`w-full px-4 py-2 rounded-md text-sm font-bold
                ${isArpeggiatorActive ? 
                  'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 
                  'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                }
                backdrop-blur-xl transition-all duration-300 shadow-md
              `}
              aria-pressed={isArpeggiatorActive}
              aria-label={isArpeggiatorActive ? 'Disable Arpeggiator' : 'Enable Arpeggiator'}
            >
              {isArpeggiatorActive ? 'Disable Arpeggiator' : 'Enable Arpeggiator'}
            </Button>
          </div>
          
          {/* Metronome Control */}
          <div className="bg-gradient-to-b from-navy-900/90 to-black/90 p-6 rounded-xl border border-gray-700/50
            backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col items-center">
            <h3 className="text-lg font-semibold text-green-400 mb-6">Metronome</h3>
            <Button
              onClick={toggleMetronome}
              className={`w-full px-4 py-2 rounded-md text-sm font-bold
                ${isMetronomeActive ? 
                  'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 
                  'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                }
                backdrop-blur-xl transition-all duration-300 shadow-md
              `}
              aria-pressed={isMetronomeActive}
              aria-label={isMetronomeActive ? 'Disable Metronome' : 'Enable Metronome'}
            >
              {isMetronomeActive ? 'Disable Metronome' : 'Enable Metronome'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sequencer */}
          <div className="bg-gradient-to-b from-navy-900/90 to-black/90 p-6 rounded-xl border border-gray-700/50
            backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300">
            <h3 className="text-lg font-semibold text-green-400 mb-6">Sequencer</h3>
            <div className="grid grid-cols-4 gap-2">
              {sequence.map((step, index) => (
                <Button
                  key={index}
                  onClick={() => toggleStep(index)}
                  className={`w-full h-12 rounded-md
                    ${step.active ? 
                      'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 
                      'bg-gray-700/50 text-gray-400 hover:bg-gray-700/70'
                    }
                    backdrop-blur-xl transition-all duration-300 shadow-md
                  `}
                  aria-pressed={step.active}
                  aria-label={`Toggle step ${index + 1} for note ${step.note}`}
                >
                  {step.note}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Preset Management */}
          <div className="bg-gradient-to-b from-navy-900/90 to-black/90 p-6 rounded-xl border border-gray-700/50
            backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col items-center">
            <h3 className="text-lg font-semibold text-green-400 mb-6">Presets</h3>
            <div className="flex space-x-4 w-full">
              <Button
                onClick={savePreset}
                className="w-full px-4 py-2 rounded-md text-sm font-bold
                  bg-blue-500/20 text-blue-400 hover:bg-blue-500/30
                  backdrop-blur-xl transition-all duration-300 shadow-md"
                aria-label="Save Preset"
              >
                Save Preset
              </Button>
              <Button
                onClick={loadPreset}
                className="w-full px-4 py-2 rounded-md text-sm font-bold
                  bg-purple-500/20 text-purple-400 hover:bg-purple-500/30
                  backdrop-blur-xl transition-all duration-300 shadow-md"
                aria-label="Load Preset"
              >
                Load Preset
              </Button>
            </div>
          </div>
          
          {/* Sample Import */}
          <div className="bg-gradient-to-b from-navy-900/90 to-black/90 p-6 rounded-xl border border-gray-700/50
            backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col items-center">
            <h3 className="text-lg font-semibold text-green-400 mb-6">Sample Import</h3>
            <input
              type="file"
              onChange={handleFileUpload}
              accept="audio/*"
              className="w-full text-sm text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-500/20 file:text-blue-400
                hover:file:bg-blue-500/30"
              aria-label="Upload Audio Sample"
            />
          </div>
        </div>

        {/* Piano Keyboard */}
        <div className="mt-8 flex justify-center">
          <div className="flex relative bg-gray-800 p-4 rounded-xl shadow-2xl overflow-x-auto">
            <div className="flex">
              {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(note => (
                <div key={note} className="flex relative">
                  <PianoKey 
                    note={`${note}2`} 
                    isSharp={false} 
                    activeNotes={activeNotes} 
                    synth={synth} 
                    setActiveNotes={setActiveNotes} 
                    isRecording={isRecording} 
                    startTimeRef={startTimeRef} 
                    setRecordedNotes={setRecordedNotes} 
                  />
                  {note !== 'E' && note !== 'B' && (
                    <PianoKey 
                      note={`${note}#2`} 
                      isSharp={true} 
                      activeNotes={activeNotes} 
                      synth={synth} 
                      setActiveNotes={setActiveNotes} 
                      isRecording={isRecording} 
                      startTimeRef={startTimeRef} 
                      setRecordedNotes={setRecordedNotes} 
                    />
                  )}
                </div>
              ))}
              {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(note => (
                <div key={note} className="flex relative">
                  <PianoKey 
                    note={`${note}3`} 
                    isSharp={false} 
                    activeNotes={activeNotes} 
                    synth={synth} 
                    setActiveNotes={setActiveNotes} 
                    isRecording={isRecording} 
                    startTimeRef={startTimeRef} 
                    setRecordedNotes={setRecordedNotes} 
                  />
                  {note !== 'E' && note !== 'B' && (
                    <PianoKey 
                      note={`${note}#3`} 
                      isSharp={true} 
                      activeNotes={activeNotes} 
                      synth={synth} 
                      setActiveNotes={setActiveNotes} 
                      isRecording={isRecording} 
                      startTimeRef={startTimeRef} 
                      setRecordedNotes={setRecordedNotes} 
                    />
                  )}
                </div>
              ))}
              {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(note => (
                <div key={note} className="flex relative">
                  <PianoKey 
                    note={`${note}4`} 
                    isSharp={false} 
                    activeNotes={activeNotes} 
                    synth={synth} 
                    setActiveNotes={setActiveNotes} 
                    isRecording={isRecording} 
                    startTimeRef={startTimeRef} 
                    setRecordedNotes={setRecordedNotes} 
                  />
                  {note !== 'E' && note !== 'B' && (
                    <PianoKey 
                      note={`${note}#4`} 
                      isSharp={true} 
                      activeNotes={activeNotes} 
                      synth={synth} 
                      setActiveNotes={setActiveNotes} 
                      isRecording={isRecording} 
                      startTimeRef={startTimeRef} 
                      setRecordedNotes={setRecordedNotes} 
                    />
                  )}
                </div>
              ))}
              {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(note => (
                <div key={note} className="flex relative">
                  <PianoKey 
                    note={`${note}5`} 
                    isSharp={false} 
                    activeNotes={activeNotes} 
                    synth={synth} 
                    setActiveNotes={setActiveNotes} 
                    isRecording={isRecording} 
                    startTimeRef={startTimeRef} 
                    setRecordedNotes={setRecordedNotes} 
                  />
                  {note !== 'E' && note !== 'B' && (
                    <PianoKey 
                      note={`${note}#5`} 
                      isSharp={true} 
                      activeNotes={activeNotes} 
                      synth={synth} 
                      setActiveNotes={setActiveNotes} 
                      isRecording={isRecording} 
                      startTimeRef={startTimeRef} 
                      setRecordedNotes={setRecordedNotes} 
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}