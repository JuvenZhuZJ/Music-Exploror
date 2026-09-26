import { useState, useEffect, useMemo, useRef } from 'react';
import * as Tone from 'tone';
import { X, Plus, Volume2, Volume1, Volume, VolumeX, ChevronLeft, ChevronRight, Link as LinkIcon } from 'lucide-react';
import {
  ROOT_NOTES,
  PITCH_CLASSES,
  generateModalMap,
  getChordRootName,
  getDefaultQuality,
  CHORD_INTERVALS,
  getModeIntervals,
  getModeSpellings,
  getNoteSpelling,
  getChordScaleName,
  COMMON_CHORD_SCALES,
  getVoicingLabel,
  getStandardChordName
} from './theory';

type Step = {
  id: string;
  isPassing?: boolean;
  passingCategory?: string;
  passingOption?: string;
  pitchClass: number;
  quality: string;
  rootIndex: number;
  octaveShift?: number;
  userOctave?: number;
  inversion?: number;
  drop?: string;
  extensionType?: 'Tri' | '7th';
  activeMidis?: number[];
  selectedMode?: string;
};

export const PASSING_CATEGORIES: Record<string, { name: string, calc: (tq: string, bq?: string) => { delta: number, q: string } }[]> = {
  'Dominant': [
    { name: 'Sec Dom (V7)', calc: () => ({ delta: 7, q: '7' }) },
    { name: 'Tritone Sub (bII7)', calc: () => ({ delta: 1, q: '7' }) },
    { name: 'Backdoor (bVII7)', calc: () => ({ delta: -2, q: '7' }) },
  ],
  'Diminished': [
    { name: 'Ascending (vii°7)', calc: () => ({ delta: -1, q: 'dim7' }) },
    { name: 'Descending (bII°7)', calc: () => ({ delta: 1, q: 'dim7' }) },
    { name: 'Common-Tone (i°7)', calc: () => ({ delta: 0, q: 'dim7' }) },
  ],
    'Augmented': [
      { name: 'Sec Dom (V+)', calc: () => ({ delta: 7, q: '7#5' }) },
      { name: 'Tritone Sub (bII+)', calc: () => ({ delta: 1, q: '7#5' }) },
      { name: 'Sym (bIII+)', calc: () => ({ delta: 3, q: '7#5' }) },
      { name: 'Sym (VII+)', calc: () => ({ delta: -1, q: '7#5' }) },
      { name: 'WT Down (bVII+)', calc: () => ({ delta: -2, q: '7#5' }) },
      { name: 'WT Up (II+)', calc: () => ({ delta: 2, q: '7#5' }) },
    ],
  'Half-Dim': [
    { name: 'Sec L.T. (viiø7)', calc: () => ({ delta: -1, q: 'm7b5' }) },
    { name: 'Sec S.T. (iiø7)', calc: () => ({ delta: 2, q: 'm7b5' }) },
    { name: 'Descending (bIIø7)', calc: () => ({ delta: 1, q: 'm7b5' }) },
  ],
  'Parallel': [
    { name: 'Descending (bII)', calc: (tq) => ({ delta: 1, q: tq }) },
    { name: 'Ascending (vii)', calc: (tq) => ({ delta: -1, q: tq }) },
  ],
  'Mediant': [
    { name: 'Upper Maj 3rd', calc: (tq) => ({ delta: 4, q: tq }) },
    { name: 'Lower Maj 3rd', calc: (tq) => ({ delta: -4, q: tq }) },
    { name: 'Upper Min 3rd', calc: (tq) => ({ delta: 3, q: tq }) },
    { name: 'Lower Min 3rd', calc: (tq) => ({ delta: -3, q: tq }) },
  ],
  'Related': [
    { name: 'Subdominant (IVmaj7)', calc: () => ({ delta: 5, q: 'maj7' }) },
    { name: 'Minor Subdom (ivm7)', calc: () => ({ delta: 5, q: 'm7' }) },
    { name: 'Supertonic (ii7)', calc: () => ({ delta: 2, q: 'm7' }) },
    { name: 'Half-Dim (iiø7)', calc: () => ({ delta: 2, q: 'm7b5' }) },
    { name: 'Mario Cadence (bVImaj7)', calc: () => ({ delta: 8, q: 'maj7' }) },
    { name: 'Backdoor (bVIImaj7)', calc: () => ({ delta: 10, q: 'maj7' }) },
    { name: 'Rel. ii7 (V of V)', calc: (_tq, bq) => {
      const isMinorTarget = bq && ( (bq.startsWith('m') && !bq.startsWith('maj')) || bq.includes('dim') || bq.includes('ø') );
      return { delta: 7, q: isMinorTarget ? 'm7b5' : 'm7' };
    } },
  ],
  'Suspensions': [
    { name: 'Dominant (7sus4)', calc: () => ({ delta: 0, q: '7sus4' }) },
    { name: 'Dominant (7sus2)', calc: () => ({ delta: 0, q: '7sus2' }) },
  ]
};

declare global {
  interface Window {
    WebAudioFontPlayer: any;
    _tone_0000_JCLive_sf2_file: any;
    _tone_0071_GeneralUserGS_sf2_file: any;
    _tone_0110_GeneralUserGS_sf2_file: any;
    _tone_0160_FluidR3_GM_sf2_file: any;
    _tone_0240_Aspirin_sf2_file: any;
    _tone_0480_Chaos_sf2_file: any;
  }
}

function WheelScroller({
  items,
  selectedIndex,
  onSelect,
  renderItem,
  className = ""
}: {
  items: any[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  renderItem: (item: any) => React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isProgrammatic = useRef(false);

  const updateHighlight = (activeIndex: number) => {
    if (!containerRef.current) return;
    const children = containerRef.current.querySelectorAll('.wheel-item');
    children.forEach((c, i) => {
      const el = c as HTMLElement;
      if (i === activeIndex) {
        el.style.color = '#0f172a'; // Dark text when inside the white pill
        el.style.fontWeight = '700';
      } else {
        el.style.color = '#64748b'; // Gray text when outside
        el.style.fontWeight = '500';
      }
    });
  };

  const scrollToItem = (child: HTMLElement, behavior: ScrollBehavior = 'auto') => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const childCenter = child.offsetTop + child.offsetHeight / 2;
    const containerCenter = container.offsetHeight / 2;
    container.scrollTo({ top: childCenter - containerCenter, behavior });
  };

  const triggerScroll = (nextIndex: number) => {
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= items.length) nextIndex = items.length - 1;
    const child = containerRef.current?.querySelector(`.wheel-item[data-index="${nextIndex}"]`) as HTMLElement;
    if (child) {
      isProgrammatic.current = true;
      scrollToItem(child, 'smooth');
      updateHighlight(nextIndex);
      setTimeout(() => isProgrammatic.current = false, 500);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(items.length - 1, selectedIndex + dir));
      triggerScroll(nextIndex);
      if (nextIndex !== selectedIndex) {
         onSelect(nextIndex);
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [items.length, selectedIndex, onSelect]);

  useEffect(() => {
    updateHighlight(selectedIndex);
    if (!isProgrammatic.current) {
      const child = containerRef.current?.querySelector(`.wheel-item[data-index="${selectedIndex}"]`) as HTMLElement;
      if (child) {
        scrollToItem(child, 'auto');
      }
    }
  }, [items, selectedIndex]);

  return (
    <div className={`flex-1 relative h-[120px] ${className}`}>
      
      {/* 1. FIXED White Pill Background (Never moves, never changes shade) */}
      <div className="absolute top-[44px] left-[10%] right-[10%] h-8 bg-white rounded-md pointer-events-none z-10 shadow-sm" />

      {/* 2. Top and Bottom Dimming Gradients (Leaves the center pill perfectly untouched) */}
      <div className="absolute top-0 left-0 right-0 h-[40px] bg-gradient-to-b from-slate-850 to-transparent pointer-events-none z-30" />
      <div className="absolute bottom-0 left-0 right-0 h-[40px] bg-gradient-to-t from-slate-850 to-transparent pointer-events-none z-30" />

      {/* 3. Scrolling Text Content */}
      <div 
        ref={containerRef}
        className="overflow-y-auto h-full w-full snap-y snap-mandatory no-scrollbar relative z-20"
        onScroll={(e) => {
          if (isProgrammatic.current) return;
          const container = e.currentTarget;
          const containerCenter = container.getBoundingClientRect().top + container.clientHeight / 2;
          
          const children = container.querySelectorAll('.wheel-item');
          let closestIndex = 0;
          let minDistance = Infinity;

          children.forEach((c, i) => {
            const rect = c.getBoundingClientRect();
            const itemCenter = rect.top + rect.height / 2;
            const distance = Math.abs(containerCenter - itemCenter);
            if (distance < minDistance) {
              minDistance = distance;
              closestIndex = i;
            }
          });
          
          updateHighlight(closestIndex);

          if (closestIndex >= 0 && closestIndex < items.length && closestIndex !== selectedIndex) {
            onSelect(closestIndex);
          }
        }}
      >
        <div className="pt-[40px] pb-[40px]">
          {items.map((item, idx) => {
             const itemKey = typeof item === 'string' ? item : (item.value ?? idx);
             return (
               <div
                 key={itemKey}
                 data-index={idx}
                 className="wheel-item snap-center h-8 my-1 flex items-center justify-center cursor-pointer text-xl transition-colors"
                 style={{ 
                   color: idx === selectedIndex ? '#0f172a' : '#64748b', 
                   fontWeight: idx === selectedIndex ? '700' : '500'
                 }}
                 onClick={() => {
                    triggerScroll(idx);
                    onSelect(idx);
                 }}
               >
                 {renderItem(item)}
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
}

export const revoiceMidis = (currentMidis: number[], rootMidi: number, inversion: number, drop: string, targetOctave: number) => {
  if (currentMidis.length === 0) return [];
  const pcs = Array.from(new Set(currentMidis.map(m => m % 12)));
  const rootPC = rootMidi % 12;
  
  pcs.sort((a,b) => ((a - rootPC + 12) % 12) - ((b - rootPC + 12) % 12));
  
  const baseMidi = 12 + targetOctave * 12 + rootPC; 
  const notes = pcs.map(pc => {
    let interval = (pc - rootPC + 12) % 12;
    return baseMidi + interval;
  });
  
  for (let i = 0; i < inversion && i < notes.length - 1; i++) {
    notes[0] += 12;
    notes.sort((a,b) => a-b);
  }
  
  if (drop === 'Drop 2' && notes.length >= 2) notes[notes.length - 2] -= 12;
  else if (drop === 'Drop 3' && notes.length >= 3) notes[notes.length - 3] -= 12;
  else if (drop === 'Drop 4' && notes.length >= 4) notes[notes.length - 4] -= 12;
  else if (drop === 'Drop 2 & 4' && notes.length >= 4) {
    notes[notes.length - 2] -= 12;
    notes[notes.length - 4] -= 12;
  }
  else if (drop === 'Drop 2 & 3' && notes.length >= 3) {
    notes[notes.length - 2] -= 12;
    notes[notes.length - 3] -= 12;
  }
  else if (drop === 'Drop 2 & 5' && notes.length >= 5) {
    notes[notes.length - 2] -= 12;
    notes[notes.length - 5] -= 12;
  }
  else if (drop === 'Drop 3 & 5' && notes.length >= 5) {
    notes[notes.length - 3] -= 12;
    notes[notes.length - 5] -= 12;
  }
  else if (drop === 'Drop 2, 4 & 6' && notes.length >= 6) {
    notes[notes.length - 2] -= 12;
    notes[notes.length - 4] -= 12;
    notes[notes.length - 6] -= 12;
  }
  
  return notes.sort((a,b) => a-b);
};
const getPlayedMidis = (step: Step) => {
  if (step.activeMidis) return step.activeMidis;
  const baseMidi = 60; // C4
  
  const targetOctave = step.userOctave ?? 4;
  const octaveOffset = (targetOctave - 4) * 12;
  
  const chordRoot = baseMidi + step.rootIndex + step.pitchClass + (step.octaveShift || 0) * 12 + octaveOffset;
  const intervals = CHORD_INTERVALS[step.quality] || [];
  const effectiveIntervals = step.extensionType === 'Tri' ? intervals.slice(0, 3) : intervals;
  const notes = effectiveIntervals.map(i => chordRoot + i);
  
  // 1. Inversion
  const inv = step.inversion || 0;
  for (let i = 0; i < inv && i < notes.length - 1; i++) {
    notes[0] += 12;
    notes.sort((a,b) => a-b);
  }
  
  // 2. Drop Voicing
  const drop = step.drop || 'Close';
  if (drop === 'Drop 2' && notes.length >= 2) {
    notes[notes.length - 2] -= 12;
  } else if (drop === 'Drop 3' && notes.length >= 3) {
    notes[notes.length - 3] -= 12;
  } else if (drop === 'Drop 4' && notes.length >= 4) {
    notes[notes.length - 4] -= 12;
  } else if (drop === 'Drop 2 & 4' && notes.length >= 4) {
    notes[notes.length - 2] -= 12;
    notes[notes.length - 4] -= 12;
  } else if (drop === 'Drop 2 & 3' && notes.length >= 3) {
    notes[notes.length - 2] -= 12;
    notes[notes.length - 3] -= 12;
  } else if (drop === 'Drop 2 & 5' && notes.length >= 5) {
    notes[notes.length - 2] -= 12;
    notes[notes.length - 5] -= 12;
  } else if (drop === 'Drop 3 & 5' && notes.length >= 5) {
    notes[notes.length - 3] -= 12;
    notes[notes.length - 5] -= 12;
  } else if (drop === 'Drop 2, 4 & 6' && notes.length >= 6) {
    notes[notes.length - 2] -= 12;
    notes[notes.length - 4] -= 12;
    notes[notes.length - 6] -= 12;
  }
  
  return notes.sort((a,b) => a-b);
};

function ModeDropdown({ borrowedFrom, selectedMode, chordRootInterval, chordQuality, chordRootName, homeKeyName, onSelect }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [namingMode, setNamingMode] = useState<'chord' | 'key'>('chord');
  
  const activeName = selectedMode || borrowedFrom[0]?.name || '';
  
  const getLabel = (modeName: string, parentName: string) => {
    if (!parentName) return modeName;
    if (namingMode === 'chord') {
      return `${chordRootName} ${getChordScaleName(modeName, parentName, chordRootInterval)}`;
    } else {
      return `${homeKeyName} ${modeName}`;
    }
  };
  
  const activeModeObj = borrowedFrom.find((m: any) => m.name === activeName) || borrowedFrom[0];
  const activeLabel = activeModeObj ? getLabel(activeName, activeModeObj.parent) : activeName;

  const alteredInjections: Record<string, any[]> = {
    '7': [
      { parent: 'Melodic Minor', name: 'Altered' }
    ],
    'maj7': [
      { parent: 'Melodic Minor', name: 'Lydian Augmented' },
      { parent: 'Harmonic Minor', name: 'Ionian Augmented' },
      { parent: 'Harmonic Major', name: 'Lydian Augmented #2' }
    ]
  };

  const baseBorrowed = [...borrowedFrom];
  const injected = alteredInjections[chordQuality] || [];
  injected.forEach(inj => {
    if (!baseBorrowed.find(b => b.name === inj.name)) {
      baseBorrowed.push({ ...inj, isAltered5: true });
    }
  });

  if (baseBorrowed.length === 0) {
    return (
      <div className="flex justify-center mb-2 h-6 items-center">
        <span className="text-xs font-bold text-slate-500 tracking-wider">NOT FOUND IN 28 MODES</span>
      </div>
    );
  }

  const commonScales = COMMON_CHORD_SCALES[chordQuality] || [];

  return (
    <div className="relative flex justify-center items-center gap-1.5 mb-2">
      <button 
        className="bg-slate-800 border border-slate-700 text-[9px] font-bold text-slate-500 tracking-wider rounded px-2 py-1 outline-none cursor-pointer hover:bg-slate-700 hover:text-slate-300 transition-colors"
        onClick={() => setNamingMode(prev => prev === 'chord' ? 'key' : 'chord')}
        title={`Currently showing ${namingMode === 'chord' ? 'Chord Scales' : 'Home Key Modes'}. Click to toggle.`}
      >
        {namingMode === 'chord' ? 'CHORD' : 'KEY'}
      </button>
      <button 
        className="bg-slate-800 border border-slate-700 text-xs font-bold text-slate-400 tracking-wider rounded px-3 py-1 outline-none cursor-pointer hover:bg-slate-700 transition-colors uppercase flex items-center gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        {activeLabel}
        <span className="text-[8px]">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-slate-850 border border-slate-700 rounded-lg shadow-2xl z-50 p-2 flex flex-col gap-2 max-h-[250px] overflow-y-auto">
            {['Major', 'Melodic Minor', 'Harmonic Minor', 'Harmonic Major'].map((parentScale, i) => {
              const modes = baseBorrowed.filter((m: any) => m.parent === parentScale);
              if (modes.length === 0) return null;
              
              const borderColors = ['border-l-blue-400', 'border-l-purple-400', 'border-l-pink-400', 'border-l-orange-400'];
              const borderColor = borderColors[i];
              
              return (
                <div key={parentScale} className={`bg-slate-800/80 p-2 rounded border-l-2 ${borderColor}`}>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{parentScale}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {modes.map((m: any) => {
                      const isActive = m.name === activeName;
                      const scaleName = getChordScaleName(m.name, m.parent, chordRootInterval);
                      const isCommon = commonScales.includes(scaleName) || m.isAltered5;
                      
                      let className = "px-2 py-0.5 rounded text-xs cursor-pointer transition-colors border flex items-center gap-1.5 ";
                      if (isActive) {
                        className += "bg-indigo-500/80 text-white font-bold shadow border-indigo-400";
                      } else if (isCommon) {
                        className += "bg-slate-700/50 text-slate-300 hover:bg-slate-600 font-medium border-transparent";
                      } else {
                        className += "bg-slate-800/40 text-slate-500 hover:bg-slate-700/80 border-slate-700/80";
                      }
                      
                      const tooltip = m.isAltered5 ? "Altered 5th Option" : (isCommon ? "" : "⚠️ Mathematically valid, but highly unconventional in jazz.");

                      return (
                        <span 
                          key={m.name} 
                          title={tooltip}
                          onClick={() => { onSelect(m.name); setIsOpen(false); }}
                          className={className}
                        >
                          <span>{getLabel(m.name, m.parent)}</span>
                          {m.isAltered5 && <span className="text-[8px] text-amber-500/90 font-bold bg-amber-500/10 px-1 rounded-sm border border-amber-500/20 leading-none py-0.5">alt5</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  const [volumeLevel, setVolumeLevel] = useState(2); // 0=mute, 1=25%, 2=50%, 3=75%, 4=100%
  const [instrumentIndex, setInstrumentIndex] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<any>(null);

  const modalMap = useMemo(() => generateModalMap(), []);
  
  const instruments = [
    { name: "Piano", label: "Piano", obj: window._tone_0000_JCLive_sf2_file },
    { name: "Clavinet", label: "Clavinet", obj: window._tone_0071_GeneralUserGS_sf2_file },
    { name: "Guitar", label: "Guitar", obj: window._tone_0240_Aspirin_sf2_file },
    { name: "Vibraphone", label: "Vibra\nphone", obj: window._tone_0110_GeneralUserGS_sf2_file },
    { name: "Organ", label: "Organ", obj: window._tone_0160_FluidR3_GM_sf2_file },
    { name: "Strings", label: "Strings", obj: window._tone_0480_Chaos_sf2_file }
  ];

  useEffect(() => {
    if (window.WebAudioFontPlayer) {
      playerRef.current = new window.WebAudioFontPlayer();
      const audioContext = Tone.getContext().rawContext as AudioContext;
      if (instruments[0].obj) playerRef.current.adjustPreset(audioContext, instruments[0].obj);
      if (instruments[1].obj) playerRef.current.adjustPreset(audioContext, instruments[1].obj);
      if (instruments[2].obj) playerRef.current.adjustPreset(audioContext, instruments[2].obj);
      if (instruments[3].obj) playerRef.current.adjustPreset(audioContext, instruments[3].obj);
      if (instruments[4].obj) playerRef.current.adjustPreset(audioContext, instruments[4].obj);
      if (instruments[5].obj) playerRef.current.adjustPreset(audioContext, instruments[5].obj);
    }
  }, []);

  const playMidis = async (midis: number[]) => {
    if (volumeLevel === 0 || !playerRef.current) return;
    await Tone.start();
    const audioContext = Tone.getContext().rawContext as AudioContext;
    const instrument = instruments[instrumentIndex].obj;
    if (!instrument) return;

    playerRef.current.cancelQueue(audioContext);
    const now = audioContext.currentTime;
    
    const volumeMultiplier = volumeLevel * 0.25;
    midis.forEach(midi => {
      playerRef.current.queueWaveTable(audioContext, audioContext.destination, instrument, now, midi, 1.5, volumeMultiplier);
    });
  };

  const playChain = async () => {
    if (volumeLevel === 0 || !playerRef.current || steps.length === 0) return;
    await Tone.start();
    const audioContext = Tone.getContext().rawContext as AudioContext;
    const instrument = instruments[instrumentIndex].obj;
    if (!instrument) return;

    playerRef.current.cancelQueue(audioContext);
    const now = audioContext.currentTime;
    
    const volumeMultiplier = volumeLevel * 0.25;
    steps.forEach((step, index) => {
      const midis = getPlayedMidis(step);
      midis.forEach(midi => {
        playerRef.current.queueWaveTable(audioContext, audioContext.destination, instrument, now + index * 1.5, midi, 1.5, volumeMultiplier);
      });
    });
  };

  const addStep = () => {
    const pc = 0; // default I
    const quality = getDefaultQuality(pc, modalMap);
    const prevRoot = steps.length > 0 ? steps[steps.length - 1].rootIndex : 0;
    const newStep: Step = {
      id: Math.random().toString(36).substr(2, 9),
      pitchClass: pc,
      quality: quality,
      rootIndex: prevRoot
    };
    setSteps([...steps, newStep]);
    playMidis(getPlayedMidis(newStep));
  };

const applyCascade = (steps: Step[]) => {
  const newSteps = [...steps];
  for (let i = newSteps.length - 2; i >= 0; i--) {
    const step = newSteps[i];
    if (step.isPassing) {
      const target = newSteps[i + 1];
      
      let baseChord = target;
      for (let j = i + 1; j < newSteps.length; j++) {
        if (!newSteps[j].isPassing) {
          baseChord = newSteps[j];
          break;
        }
      }

      const safeCatName = PASSING_CATEGORIES[step.passingCategory || 'Dominant'] ? (step.passingCategory || 'Dominant') : 'Dominant';
      const cat = PASSING_CATEGORIES[safeCatName];
      const opt = cat.find(o => o.name === (step.passingOption || 'Sec Dom (V7)')) || cat[0];
      const result = opt.calc(target.quality, baseChord.quality);
      
      let pc = (target.pitchClass + result.delta) % 12;
      if (pc < 0) pc += 12;
      const octaveShift = Math.floor((target.pitchClass + result.delta) / 12) + (target.octaveShift || 0);
      
      if (step.pitchClass !== pc || step.quality !== result.q || step.rootIndex !== target.rootIndex || step.octaveShift !== octaveShift) {
        newSteps[i] = {
          ...step,
          pitchClass: pc,
          quality: result.q,
          rootIndex: target.rootIndex,
          octaveShift,
          activeMidis: undefined,
          selectedMode: undefined
        };
      }
    }
  }
  return newSteps;
};

  const insertBaseChord = (atIndex: number) => {
    setSteps(prev => {
      const pc = 0; // default I
      const quality = getDefaultQuality(pc, modalMap);
      const prevRoot = prev.length > 0 ? prev[prev.length - 1].rootIndex : 0;
      const newStep: Step = {
        id: Math.random().toString(36).substr(2, 9),
        pitchClass: pc,
        quality: quality,
        rootIndex: prevRoot
      };
      const newSteps = [...prev];
      newSteps.splice(atIndex, 0, newStep);
      return applyCascade(newSteps);
    });
  };

  const getIslands = (steps: Step[]) => {
    const islands: Step[][] = [];
    let currentIsland: Step[] = [];
    steps.forEach(s => {
      currentIsland.push(s);
      if (!s.isPassing) {
        islands.push(currentIsland);
        currentIsland = [];
      }
    });
    if (currentIsland.length > 0) islands.push(currentIsland);
    return islands;
  };

  const moveIsland = (id: string, dir: number) => {
    setSteps(prev => {
      const step = prev.find(s => s.id === id);
      if (!step) return prev;

      const islands = getIslands(prev);

      if (step.isPassing) {
        const islandIndex = islands.findIndex(isl => isl.some(s => s.id === id));
        if (islandIndex === -1) return prev;
        const island = islands[islandIndex];
        const stepIdxInIsland = island.findIndex(s => s.id === id);
        
        const targetIdxInIsland = stepIdxInIsland + dir;
        if (targetIdxInIsland < 0 || targetIdxInIsland >= island.length - 1) return prev;
        
        const newIsland = [...island];
        [newIsland[stepIdxInIsland], newIsland[targetIdxInIsland]] = [newIsland[targetIdxInIsland], newIsland[stepIdxInIsland]];
        islands[islandIndex] = newIsland;
      } else {
        const islandIndex = islands.findIndex(isl => isl[isl.length - 1]?.id === id);
        if (islandIndex === -1) return prev;
        
        const targetIslandIndex = islandIndex + dir;
        if (targetIslandIndex < 0 || targetIslandIndex >= islands.length) return prev;
        
        const newIslands = [...islands];
        [newIslands[islandIndex], newIslands[targetIslandIndex]] = [newIslands[targetIslandIndex], newIslands[islandIndex]];
        islands.splice(0, islands.length, ...newIslands);
      }
      
      const newSteps = islands.flat();
      return applyCascade(newSteps);
    });
  };

  const teleportIsland = (id: string, targetIslandIndex: number) => {
    setSteps(prev => {
      const islands = getIslands(prev);
      const islandIndex = islands.findIndex(isl => isl[isl.length - 1]?.id === id);
      if (islandIndex === -1 || islandIndex === targetIslandIndex) return prev;
      
      const newIslands = [...islands];
      const [movedIsland] = newIslands.splice(islandIndex, 1);
      newIslands.splice(targetIslandIndex, 0, movedIsland);
      
      const newSteps = newIslands.flat();
      return applyCascade(newSteps);
    });
  };

  const updateStep = (id: string, updates: Partial<Step>) => {
    setSteps(prev => {
      let newSteps = prev.map(s => {
        if (s.id !== id) return s;
        const updated = { ...s, ...updates };
        
        let structuralChange = false;
        if (updates.pitchClass !== undefined && updates.pitchClass !== s.pitchClass) {
          if (!updated.isPassing) {
            updated.quality = getDefaultQuality(updates.pitchClass, modalMap);
          }
          structuralChange = true;
        }
        if (updates.quality !== undefined && updates.quality !== s.quality) {
          structuralChange = true;
        }
        if (updates.rootIndex !== undefined && updates.rootIndex !== s.rootIndex) {
          structuralChange = true;
        }
        
        if (updates.passingCategory || updates.passingOption) {
          structuralChange = true;
        }

        if (structuralChange) {
          updated.activeMidis = undefined;
          updated.selectedMode = undefined;
        }
        
        return updated;
      });

      newSteps = applyCascade(newSteps);

      const finalUpdatedStep = newSteps.find(s => s.id === id);
      if (finalUpdatedStep) {
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          playMidis(getPlayedMidis(finalUpdatedStep));
        }, 150);
      }

      return newSteps;
    });
  };

  const addPassingStep = (targetId: string) => {
    setSteps(prev => {
      const targetIndex = prev.findIndex(s => s.id === targetId);
      if (targetIndex === -1) return prev;
      
      const target = prev[targetIndex];
      let baseChord = target;
      for (let j = targetIndex; j < prev.length; j++) {
        if (!prev[j].isPassing) {
          baseChord = prev[j];
          break;
        }
      }
      const opt = PASSING_CATEGORIES['Dominant'][0];
      const result = opt.calc(target.quality, baseChord.quality);
      
      let pc = (target.pitchClass + result.delta) % 12;
      if (pc < 0) pc += 12;
      const octaveShift = Math.floor((target.pitchClass + result.delta) / 12) + (target.octaveShift || 0);
      
      const newStep: Step = {
        id: Math.random().toString(36).substr(2, 9),
        isPassing: true,
        passingCategory: 'Dominant',
        passingOption: 'Sec Dom (V7)',
        pitchClass: pc,
        quality: result.q,
        rootIndex: target.rootIndex,
        octaveShift
      };
      
      const newSteps = [...prev];
      newSteps.splice(targetIndex, 0, newStep);
      
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        playMidis(getPlayedMidis(newStep));
      }, 50);

      return newSteps;
    });
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const clearAll = () => {
    setSteps([]);
  };

  const islands = getIslands(steps);

  const renderStepEditor = (step: Step, index: number) => {
    const chordRootName = getChordRootName(step.rootIndex, step.pitchClass);
    
    let lookupQuality = step.quality;
    if (step.extensionType === 'Tri') {
      if (['maj7', '7'].includes(step.quality)) lookupQuality = 'maj';
      else if (['m7', 'mmaj7'].includes(step.quality)) lookupQuality = 'm';
      else if (['m7b5', 'dim7'].includes(step.quality)) lookupQuality = 'dim';
      else if (['maj7#5', '7#5'].includes(step.quality)) lookupQuality = 'aug';
      else if (step.quality === '7sus4') lookupQuality = 'sus4';
      else if (step.quality === '7sus2') lookupQuality = 'sus2';
    }

      const allQualities = Object.keys(modalMap[step.pitchClass] || {});
      const TRIAD_QUALITIES = ['maj', 'm', 'dim', 'aug'];
      const SEVENTH_QUALITIES = ['maj7', 'm7', '7', 'm7b5', 'dim7', 'mmaj7', 'maj7#5'];
      
      const isTriad = step.extensionType === 'Tri';
      const validQualities = isTriad ? TRIAD_QUALITIES : SEVENTH_QUALITIES;
      const availableQualities = allQualities.filter(q => validQualities.includes(q));

      const borrowedFrom = modalMap[step.pitchClass][lookupQuality] || [];

    const baseMidi = 60; 
    const chordRoot = baseMidi + step.rootIndex + step.pitchClass + (step.octaveShift || 0) * 12;
    
    const playedMidis = getPlayedMidis(step);

    const activeModeName = step.selectedMode || borrowedFrom[0]?.name;
    const modeSpellings = activeModeName ? getModeSpellings(activeModeName) : {};
    const degreesFallback = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
    
    let slashSuffix = "";
    if (playedMidis.length > 0) {
      const bassMidi = Math.min(...playedMidis);
      const bassInterval = (bassMidi - chordRoot + 120) % 12;
      if (bassInterval !== 0) {
        let degreeName = modeSpellings[bassInterval] || degreesFallback[bassInterval];
        // Convert any extension degrees back to base intervals for the speller
        degreeName = degreeName.replace('9', '2').replace('11', '4').replace('13', '6');
        const spelledBass = getNoteSpelling(step.rootIndex, step.pitchClass, bassInterval, degreeName);
        slashSuffix = `/${spelledBass}`;
      }
    }
    
    const standardName = getStandardChordName(playedMidis, chordRoot);
    const chordName = `${chordRootName}${standardName.base}${slashSuffix}`;
    const extensionString = standardName.ext;
        
    const chordIntervalsObj = CHORD_INTERVALS[lookupQuality || 'maj'] || [];
    const voicingLabel = getVoicingLabel(playedMidis, chordRoot, chordIntervalsObj);

    const isPassing = step.isPassing;
    const hasPassingLeft = index > 0 && steps[index - 1].isPassing;
    
    const availableCategories = Object.keys(PASSING_CATEGORIES);
    const activeCategory = PASSING_CATEGORIES[step.passingCategory || 'Dominant'] ? (step.passingCategory || 'Dominant') : 'Dominant';
    const availableOptions = PASSING_CATEGORIES[activeCategory].map(o => o.name);

    const islandIndex = islands.findIndex(isl => isl.some(s => s.id === step.id));
    const island = islands[islandIndex];
    const stepIdxInIsland = island.findIndex(s => s.id === step.id);

    const headerBgClass = isPassing 
      ? (hasPassingLeft ? 'bg-gradient-to-r from-purple-900/40 to-purple-900/10' : 'bg-purple-900/10')
      : (hasPassingLeft ? 'bg-gradient-to-r from-purple-900/30 to-transparent' : 'bg-transparent');
    const headerBorderClass = isPassing ? 'border-purple-700/50' : 'border-slate-700/50';

    return (
      <div key={step.id} className={`flex-1 flex-shrink-0 w-80 bg-slate-850 rounded-lg border flex flex-col shadow-xl relative ${isPassing ? 'border-purple-500/60 shadow-purple-500/10' : 'border-slate-700'}`}>
        
        {/* CHAIN TAB */}
        <button 
          onClick={() => {
            addPassingStep(step.id);
          }}
          className={`absolute top-2 w-6 h-10 ${
            hasPassingLeft ? '-left-6 border-r-0 rounded-l-md' : 'left-0 border-l-0 rounded-r-md'
          } ${
            hasPassingLeft ? 'bg-purple-900 border-purple-500/60' : 'bg-slate-800 border-slate-700'
          } border flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer group z-40 shadow-[-4px_0_10px_rgba(0,0,0,0.1)]`}
          title="Insert Passing Chord"
        >
          <LinkIcon size={14} className={`opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-transform ${hasPassingLeft ? 'text-purple-300' : 'text-slate-400'}`} />
        </button>

        <div className={`flex justify-between items-center p-3 border-b ${headerBorderClass} ${headerBgClass} h-[54px]`}>
          <div className="flex items-center gap-3 px-8">
            
            {isPassing ? (
              <div className="flex items-center bg-purple-800 text-purple-200 rounded-full p-0.5">
                <button onClick={() => moveIsland(step.id, -1)} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"><ChevronLeft size={12} /></button>
                <span className="text-xs font-bold px-1 min-w-[20px] text-center">{islandIndex + 1}-{stepIdxInIsland + 1}</span>
                <button onClick={() => moveIsland(step.id, 1)} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"><ChevronRight size={12} /></button>
              </div>
            ) : (
              <div className="flex items-center bg-slate-700 text-slate-300 rounded-full p-0.5">
                <button onClick={() => moveIsland(step.id, -1)} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"><ChevronLeft size={12} /></button>
                <div className="relative group flex items-center justify-center">
                  <select 
                    className="appearance-none bg-transparent font-bold text-xs text-center px-1 min-w-[20px] cursor-pointer outline-none hover:text-white"
                    value={islandIndex}
                    onChange={(e) => teleportIsland(step.id, Number(e.target.value))}
                  >
                    {islands.map((_, i) => <option key={i} value={i} className="text-black">{i + 1}</option>)}
                  </select>
                </div>
                <button onClick={() => moveIsland(step.id, 1)} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"><ChevronRight size={12} /></button>
              </div>
            )}
            
            {!isPassing ? (
              <select
                value={step.rootIndex}
                onChange={(e) => updateStep(step.id, { rootIndex: Number(e.target.value) })}
                className="bg-slate-800 border border-slate-700 text-white rounded text-sm px-2 py-1 outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500"
              >
                {ROOT_NOTES.map((note, idx) => (
                  <option key={note} value={idx}>{note}</option>
                ))}
              </select>
            ) : (
              <div className="text-xs font-bold text-purple-400 tracking-wider">PASSING CHORD</div>
            )}
          </div>
          <button onClick={() => removeStep(step.id)} className="text-red-500 hover:text-red-400 transition-colors mr-4">
            <X size={16} />
          </button>
        </div>
        <div className={`flex h-[120px] border-b ${isPassing ? 'border-purple-700/50 bg-purple-900/10' : 'border-slate-700/50'} relative`}>
          
          {isPassing ? (
            <>
              <WheelScroller 
                items={availableCategories}
                selectedIndex={availableCategories.indexOf(activeCategory)}
                onSelect={(idx) => updateStep(step.id, { passingCategory: availableCategories[idx], passingOption: PASSING_CATEGORIES[availableCategories[idx]][0].name })}
                renderItem={(c) => c}
                className="border-r border-purple-700/50"
              />
              <WheelScroller 
                items={availableOptions}
                selectedIndex={availableOptions.indexOf(step.passingOption || '')}
                onSelect={(idx) => updateStep(step.id, { passingOption: availableOptions[idx] })}
                renderItem={(o) => <span className="text-sm">{o}</span>}
              />
            </>
          ) : (
            <>
              <WheelScroller 
                items={PITCH_CLASSES}
                selectedIndex={PITCH_CLASSES.findIndex(pc => pc.value == step.pitchClass)}
                onSelect={(index) => updateStep(step.id, { pitchClass: PITCH_CLASSES[index].value })}
                renderItem={(pc) => pc.label}
                className="border-r border-slate-700/50"
              />
              <WheelScroller 
                items={availableQualities}
                selectedIndex={availableQualities.findIndex(q => q === (isTriad ? lookupQuality : step.quality))}
                onSelect={(index) => {
                  const selectedQ = availableQualities[index];
                  const triadToSeventh: Record<string, string> = {
                    'maj': 'maj7',
                    'm': 'm7',
                    'dim': 'm7b5',
                    'aug': '7#5'
                  };
                  const newQuality = isTriad ? (triadToSeventh[selectedQ] || selectedQ) : selectedQ;
                  updateStep(step.id, { quality: newQuality });
                }}
                renderItem={(q) => q}
              />
            </>
          )}
        </div>

        <div 
          className="py-3 bg-slate-900/50 flex flex-col justify-center items-center cursor-pointer hover:bg-slate-800/50 transition-colors"
          onClick={() => playMidis(playedMidis)}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-emerald-200 tracking-wider">
              {chordName}
            </span>
            {extensionString && (
              <span className="text-sm font-bold text-teal-400/80 tracking-widest">
                {extensionString}
              </span>
            )}
          </div>
          {(() => {
            let displayOctave: number | string = step.userOctave ?? 4;
            let displayInversion: number | string = step.inversion ?? "Auto";
            let displayDrop = step.drop ?? "Auto";

            if (step.inversion === undefined || step.drop === undefined) {
              if (voicingLabel.includes("Root Pos")) displayInversion = 0;
              else if (voicingLabel.includes("1st Inv")) displayInversion = 1;
              else if (voicingLabel.includes("2nd Inv")) displayInversion = 2;
              else if (voicingLabel.includes("3rd Inv")) displayInversion = 3;
              else if (voicingLabel.includes("4th Inv")) displayInversion = 4;
              else if (voicingLabel.includes("5th Inv")) displayInversion = 5;
              else if (voicingLabel.includes("6th Inv")) displayInversion = 6;
              else displayInversion = "Custom";

              if (voicingLabel.includes("Close")) displayDrop = "Close";
              else if (voicingLabel.includes("Drop 2 & 4") || voicingLabel.includes("Drop 4 & 2")) displayDrop = "Drop 2 & 4";
              else if (voicingLabel.includes("Drop 2 & 3") || voicingLabel.includes("Drop 3 & 2")) displayDrop = "Drop 2 & 3";
              else if (voicingLabel.includes("Drop 2 & 5") || voicingLabel.includes("Drop 5 & 2")) displayDrop = "Drop 2 & 5";
              else if (voicingLabel.includes("Drop 3 & 5") || voicingLabel.includes("Drop 5 & 3")) displayDrop = "Drop 3 & 5";
              else if (voicingLabel.includes("Drop 2, 4 & 6")) displayDrop = "Drop 2, 4 & 6";
              else if (voicingLabel.includes("Drop 2")) displayDrop = "Drop 2";
              else if (voicingLabel.includes("Drop 3")) displayDrop = "Drop 3";
              else if (voicingLabel.includes("Drop 4")) displayDrop = "Drop 4";
              else displayDrop = "Custom";
            }

            const selectClass = "bg-slate-800/80 border border-slate-700/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider rounded px-1.5 py-0.5 outline-none cursor-pointer hover:bg-slate-700 hover:text-slate-200 transition-colors focus:ring-1 focus:ring-indigo-500/50";

            return (
              <div className="flex items-center gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                <select 
                  value={displayOctave} 
                  onChange={(e) => {
                     const newOct = Number(e.target.value);
                     if (step.activeMidis) {
                        const currentInv = Number(displayInversion) || 0;
                        const newMidis = revoiceMidis(playedMidis, chordRoot, currentInv, displayDrop, newOct);
                        updateStep(step.id, { userOctave: newOct, inversion: currentInv, drop: displayDrop, activeMidis: newMidis });
                     } else {
                        updateStep(step.id, { userOctave: newOct, activeMidis: undefined });
                     }
                  }}
                  className={selectClass}
                >
                  {[3, 4, 5, 6].map(o => <option key={o} value={o}>Oct {o}</option>)}
                  {String(displayOctave) === "Custom" && <option value="Custom">Custom</option>}
                </select>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newExt = (step.extensionType || '7th') === '7th' ? 'Tri' : '7th';
                    updateStep(step.id, { extensionType: newExt, activeMidis: undefined });
                  }}
                  className={selectClass}
                  title="Toggle Tri / 7th"
                >
                  {step.extensionType || '7th'}
                </button>

                <select 
                  value={displayInversion} 
                  onChange={(e) => {
                     const newInv = Number(e.target.value);
                     if (step.activeMidis) {
                        const currentOct = Number(displayOctave) || 4;
                        const newMidis = revoiceMidis(playedMidis, chordRoot, newInv, displayDrop, currentOct);
                        updateStep(step.id, { userOctave: currentOct, inversion: newInv, drop: displayDrop, activeMidis: newMidis });
                     } else {
                        updateStep(step.id, { inversion: newInv, activeMidis: undefined });
                     }
                  }}
                  className={selectClass}
                >
                  <option value={0}>Root Pos</option>
                  {playedMidis.length > 1 && <option value={1}>1st Inv</option>}
                  {playedMidis.length > 2 && <option value={2}>2nd Inv</option>}
                  {playedMidis.length > 3 && <option value={3}>3rd Inv</option>}
                  {playedMidis.length > 4 && <option value={4}>4th Inv</option>}
                  {playedMidis.length > 5 && <option value={5}>5th Inv</option>}
                  {playedMidis.length > 6 && <option value={6}>6th Inv</option>}
                  {displayInversion === "Custom" && <option value="Custom">Custom Inv</option>}
                </select>

                <select 
                  value={displayDrop} 
                  onChange={(e) => {
                     const newDrop = e.target.value;
                     if (step.activeMidis) {
                        const currentInv = Number(displayInversion) || 0;
                        const currentOct = Number(displayOctave) || 4;
                        const newMidis = revoiceMidis(playedMidis, chordRoot, currentInv, newDrop, currentOct);
                        updateStep(step.id, { userOctave: currentOct, inversion: currentInv, drop: newDrop, activeMidis: newMidis });
                     } else {
                        updateStep(step.id, { drop: newDrop, activeMidis: undefined });
                     }
                  }}
                  className={selectClass}
                >
                  <option value="Close">Close</option>
                  <option value="Drop 2">Drop 2</option>
                  <option value="Drop 3">Drop 3</option>
                  {playedMidis.length >= 4 && <option value="Drop 4">Drop 4</option>}
                  {playedMidis.length >= 4 && <option value="Drop 2 & 4">Drop 2 & 4</option>}
                  {playedMidis.length >= 4 && <option value="Drop 2 & 3">Drop 2 & 3</option>}
                  {playedMidis.length >= 5 && <option value="Drop 2 & 5">Drop 2 & 5</option>}
                  {playedMidis.length >= 5 && <option value="Drop 3 & 5">Drop 3 & 5</option>}
                  {playedMidis.length >= 6 && <option value="Drop 2, 4 & 6">Drop 2, 4 & 6</option>}
                  {displayDrop === "Custom" && <option value="Custom">Custom Drop</option>}
                </select>
              </div>
            );
          })()}
        </div>

        <div className="p-4 flex-1 flex flex-col gap-2 min-h-[160px]">
          <ModeDropdown 
            borrowedFrom={borrowedFrom} 
            selectedMode={step.selectedMode} 
            chordRootInterval={step.pitchClass}
            chordQuality={lookupQuality}
            chordRootName={getChordRootName(step.rootIndex, step.pitchClass)}
            homeKeyName={getChordRootName(step.rootIndex, 0)}
            onSelect={(mode: string) => updateStep(step.id, { selectedMode: mode })} 
          />
          <div 
            className="voice-scroll-container flex flex-col gap-[3px] overflow-y-auto h-[276px] no-scrollbar snap-y"
            ref={(el) => {
              if (el) {
                if (!el.dataset.initializedScroll) {
                  el.dataset.initializedScroll = 'true';
                  el.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const dir = e.deltaY > 0 ? 1 : -1;
                    const currentIndex = Math.round(el.scrollTop / 23);
                    const maxIndex = 48 - 12; 
                    const targetIndex = Math.max(0, Math.min(maxIndex, currentIndex + dir));
                    el.scrollTo({ top: targetIndex * 23, behavior: 'smooth' });
                  }, { passive: false });
                }

                const currentRoot = (baseMidi + step.rootIndex + step.pitchClass + (step.octaveShift || 0) * 12).toString();
                if (el.dataset.lastRoot !== currentRoot) {
                  el.dataset.lastRoot = currentRoot;
                  const rowIndex = 83 - Number(currentRoot);
                  // Put the root note exactly at the bottom (rowIndex - 11)
                  const targetIndex = Math.max(0, Math.min(48 - 12, rowIndex - 11)); 
                  
                  // Smoothly scroll ONLY this container, letting its onScroll event sync the others
                  setTimeout(() => {
                    if (el) el.scrollTo({ top: targetIndex * 23, behavior: 'smooth' });
                  }, 10);
                }
              }
            }}
            onScroll={(e) => {
              const current = e.currentTarget as HTMLElement;
              if (current.dataset.ignoreScroll === 'true') {
                current.dataset.ignoreScroll = 'false';
                return;
              }
              const targetTop = current.scrollTop;
              document.querySelectorAll('.voice-scroll-container').forEach(el => {
                if (el !== current) {
                  const htmlEl = el as HTMLElement;
                  htmlEl.dataset.ignoreScroll = 'true';
                  htmlEl.scrollTop = targetTop;
                }
              });
            }}
          >
            {Array.from({ length: 48 }).map((_, i) => {
              const midi = 83 - i; 
              
              const baseMidi = 60; 
              const chordRoot = baseMidi + step.rootIndex + step.pitchClass + (step.octaveShift || 0) * 12;
              const playedMidis = getPlayedMidis(step);
              
              const isActive = playedMidis.includes(midi);
              const isAnyRoot = (midi % 12) === (chordRoot % 12);
              const isRoot = isAnyRoot && isActive; 
              const isCore = !isAnyRoot && isActive;
              
              const interval = ((midi - chordRoot) % 12 + 12) % 12;
              const theoreticalIntervals = (CHORD_INTERVALS[lookupQuality] || []).map(i => i % 12);
              const isTheoreticalChordTone = theoreticalIntervals.includes(interval);
              const isTheoreticalRoot = isAnyRoot;
              const isTheoreticalCore = isTheoreticalChordTone && !isAnyRoot;

              const activeModeName = step.selectedMode || borrowedFrom[0]?.name;
              const activeModeIntervals = activeModeName ? getModeIntervals(activeModeName) : [];
              
              const intervalFromKey = ((midi - (baseMidi + step.rootIndex)) % 12 + 12) % 12;
              const isExtension = activeModeIntervals.includes(intervalFromKey) && !isTheoreticalChordTone;

              const modeSpellings = activeModeName ? getModeSpellings(activeModeName) : {};
              const degreesFallback = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
              const degree = modeSpellings[interval] || degreesFallback[interval];
              
              const noteName = getNoteSpelling(step.rootIndex, step.pitchClass, interval, degree);
              const octave = Math.floor(midi / 12) - 1;

              const toggleMidi = () => {
                 let newMidis = [...playedMidis];
                 if (newMidis.includes(midi)) {
                   newMidis = newMidis.filter(m => m !== midi);
                 } else {
                   newMidis.push(midi);
                 }
                 newMidis.sort((a,b) => a - b);
                 
                 let newQuality = step.quality;
                 let newExtType = step.extensionType;
                 
                 const sortedPCs = Array.from(new Set(newMidis.map(m => (m - chordRoot + 120) % 12))).sort((a,b) => a-b);
                 
                 const TRIAD_QUALITIES = ['maj', 'm', 'dim', 'aug'];
                 const seventhEntries = Object.entries(CHORD_INTERVALS).filter(([q]) => !TRIAD_QUALITIES.includes(q) && !['sus2', 'sus4', '7sus2', '7sus4'].includes(q));
                 const triadEntries = Object.entries(CHORD_INTERVALS).filter(([q]) => TRIAD_QUALITIES.includes(q));
                 
                 let matched = false;
                 for (const [q, ints] of seventhEntries) {
                   if (ints.every(val => sortedPCs.includes(val))) {
                     newExtType = '7th';
                     newQuality = q;
                     matched = true;
                     break;
                   }
                 }
                 
                 if (!matched) {
                   for (const [q, ints] of triadEntries) {
                     if (ints.every(val => sortedPCs.includes(val))) {
                       newExtType = 'Tri';
                       const triadToSeventh: Record<string, string> = { 'maj': 'maj7', 'm': 'm7', 'dim': 'm7b5', 'aug': '7#5' };
                       newQuality = triadToSeventh[q] || q;
                       break;
                     }
                   }
                 }
                 
                 updateStep(step.id, { activeMidis: newMidis, quality: newQuality, extensionType: newExtType, inversion: undefined, drop: undefined, userOctave: undefined });
              };
              
              return (
                <div 
                  key={midi} 
                  className="flex items-center gap-3 snap-start cursor-pointer hover:bg-slate-700/30 p-0.5 -m-0.5 rounded transition-colors"
                  onClick={toggleMidi}
                >
                  <div className="w-14 flex justify-between text-[11px] font-bold shrink-0">
                    <span className={`w-4 ${
                      isTheoreticalRoot ? 'text-red-400' : 
                      isTheoreticalCore ? 'text-slate-300' : 
                      isExtension ? 'text-green-400' :
                      'text-slate-600'
                    }`}>{degree}</span>
                    <span className={`w-8 text-right ${
                      isTheoreticalRoot ? 'text-red-400' : 
                      isTheoreticalCore ? 'text-slate-100' : 
                      isExtension ? 'text-green-400' :
                      'text-slate-600'
                    }`}>{noteName}{octave}</span>
                  </div>
                  <div 
                    className={`h-[20px] flex-1 rounded-sm ${
                      isRoot ? 'bg-red-500' : 
                      isCore ? 'bg-slate-100' : 
                      'bg-slate-700/60'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Floating Action Buttons */}
        <div className="fixed top-6 right-6 flex flex-row gap-4 z-50">
          <button
            onClick={() => setInstrumentIndex((prev) => (prev + 1) % instruments.length)}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 bg-slate-700 text-teal-300 hover:bg-slate-600 hover:scale-105 border border-slate-600"
            title={`Switch Instrument: ${instruments[instrumentIndex].name}`}
          >
            <div className="text-xs font-bold leading-tight text-center whitespace-pre-line">
              {instruments[instrumentIndex].label}
            </div>
          </button>

          <button
            onClick={async () => {
              if (volumeLevel === 0) await Tone.start();
              setVolumeLevel((prev) => (prev + 1) % 5);
            }}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300
              ${volumeLevel > 0 
                ? 'bg-teal-500 hover:bg-teal-400 text-slate-900 shadow-teal-500/20' 
                : 'bg-slate-700 hover:bg-slate-600 text-slate-400'
              } hover:scale-105 relative`}
            title={
              volumeLevel === 0 ? "Muted" : 
              volumeLevel === 1 ? "Volume: 25%" :
              volumeLevel === 2 ? "Volume: 50%" :
              volumeLevel === 3 ? "Volume: 75%" : "Volume: 100%"
            }
          >
            {volumeLevel === 0 ? <VolumeX size={24} /> : 
             volumeLevel === 1 ? <Volume size={24} /> :
             volumeLevel === 2 ? <Volume1 size={24} /> :
             <Volume2 size={24} />}
          </button>
        </div>

        {/* Controls */}
        <div className="flex gap-4 items-center">
          <button 
            onClick={playChain}
            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md font-bold transition-colors shadow-lg shadow-indigo-500/20"
          >
            Play Chain
          </button>
          <button 
            onClick={clearAll}
            className="px-6 py-2 bg-transparent border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-md font-semibold transition-colors"
          >
            Clear All
          </button>
        </div>

        {/* Chain Viewer */}
        <div className="flex overflow-x-auto pb-8 pt-6 items-stretch no-scrollbar snap-x">
          <div className="min-w-[32px] flex-shrink-0 snap-start" />
          {steps.map((step, index) => (
            <div key={step.id} className={`${index === 0 ? '' : 'snap-start scroll-ml-8'} relative flex flex-col ${step.isPassing ? 'mr-0' : 'mr-6'}`}>
              {index === 0 && (
                <button
                  onClick={() => insertBaseChord(0)}
                  className="absolute -left-6 top-[-22px] w-6 h-6 bg-slate-800 border border-slate-600 rounded-tl-full rounded-tr-full rounded-bl-full rounded-br-md flex items-center justify-center shadow-lg hover:bg-indigo-500 hover:border-indigo-400 z-50 transition-all hover:scale-110 rotate-45 cursor-pointer group"
                  title="Insert Base Chord at Beginning"
                >
                  <Plus size={16} className="text-slate-400 group-hover:text-white -rotate-45" />
                </button>
              )}
              {renderStepEditor(step, index)}
              {!step.isPassing && index < steps.length - 1 && (
                <button
                  onClick={() => insertBaseChord(index + 1)}
                  className="absolute -right-6 top-[-22px] w-6 h-6 bg-slate-800 border border-slate-600 rounded-tl-full rounded-tr-full rounded-bl-full rounded-br-md flex items-center justify-center shadow-lg hover:bg-indigo-500 hover:border-indigo-400 z-50 transition-all hover:scale-110 rotate-45 cursor-pointer group"
                  title="Insert Base Chord"
                >
                  <Plus size={16} className="text-slate-400 group-hover:text-white -rotate-45" />
                </button>
              )}
            </div>
          ))}
          
          <button 
            onClick={addStep}
            className="flex-shrink-0 w-80 min-h-[520px] border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all group cursor-pointer snap-start"
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl group-hover:scale-110 transition-transform font-light">+</span>
              <span className="text-sm font-bold tracking-widest uppercase">Add Chord</span>
            </div>
          </button>
        </div>
        
      </div>
    </div>
  );
}

export default App;
