export const ROOT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const PITCH_CLASSES = [
  { value: 0, label: 'I' },
  { value: 1, label: 'bII' },
  { value: 2, label: 'II' },
  { value: 3, label: 'bIII' },
  { value: 4, label: 'III' },
  { value: 5, label: 'IV' },
  { value: 6, label: 'bV' },
  { value: 7, label: 'V' },
  { value: 8, label: 'bVI' },
  { value: 9, label: 'VI' },
  { value: 10, label: 'bVII' },
  { value: 11, label: 'VII' }
];

export const DEFAULT_QUALITIES: Record<number, string> = {
  0: 'maj7',
  1: 'maj7',
  2: 'm7',
  3: 'maj7',
  4: 'm7',
  5: 'maj7',
  6: 'maj7',
  7: '7',
  8: 'maj7',
  9: 'm7',
  10: '7',
  11: 'm7b5'
};

export const COMMON_CHORD_SCALES: Record<string, string[]> = {
  'maj7': ['Ionian', 'Lydian'],
  'm7': ['Dorian', 'Phrygian', 'Aeolian', 'Dorian b2'],
  '7': ['Mixolydian', 'Lydian Dominant', 'Mixolydian b6', 'Phrygian Dominant', 'Mixolydian b2'],
  'm7b5': ['Locrian', 'Locrian #2', 'Locrian ♮6'],
  'dim7': ['Altered Diminished', 'Locrian bb7'],
  'mmaj7': ['Melodic Minor', 'Harmonic Minor'],
  'maj7#5': ['Lydian Augmented', 'Ionian Augmented'],
  '7#5': ['Altered', 'Mixolydian b6']
};

export const SCALES: Record<string, number[]> = {
  "Major": [0, 2, 4, 5, 7, 9, 11],
  "Melodic Minor": [0, 2, 3, 5, 7, 9, 11],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
  "Harmonic Major": [0, 2, 4, 5, 7, 8, 11]
};

export const MODE_NAMES: Record<string, string[]> = {
  "Major": ["Ionian", "Dorian", "Phrygian", "Lydian", "Mixolydian", "Aeolian", "Locrian"],
  "Melodic Minor": ["Melodic Minor", "Dorian b2", "Lydian Augmented", "Lydian Dominant", "Mixolydian b6", "Locrian #2", "Altered"],
  "Harmonic Minor": ["Harmonic Minor", "Locrian ♮6", "Ionian Augmented", "Dorian #4", "Phrygian Dominant", "Lydian #2", "Altered Diminished"],
  "Harmonic Major": ["Harmonic Major", "Dorian b5", "Phrygian b4", "Lydian b3", "Mixolydian b2", "Lydian Augmented #2", "Locrian bb7"]
};

export function getModeIntervals(modeName: string): number[] {
  for (const [parent, parentIntervals] of Object.entries(SCALES)) {
    const m = MODE_NAMES[parent].indexOf(modeName);
    if (m !== -1) {
      const modeIntervals = [];
      for (let i = 0; i < 7; i++) {
        modeIntervals.push((parentIntervals[(m + i) % 7] - parentIntervals[m] + 12) % 12);
      }
      return modeIntervals;
    }
  }
  return [];
}

export function getModeSpellings(modeName: string): Record<number, string> {
  const modeIntervals = getModeIntervals(modeName);
  const spellings: Record<number, string> = { 0: 'R' };
  
  if (modeIntervals.length === 7) {
    for (let i = 1; i < 7; i++) {
      const val = modeIntervals[i];
      if (i === 1) { // 2nd
        if (val === 1) spellings[val] = 'b2';
        else if (val === 2) spellings[val] = '2';
        else if (val === 3) spellings[val] = '#2';
      } else if (i === 2) { // 3rd
        if (val === 3) spellings[val] = 'b3';
        else if (val === 4) spellings[val] = '3';
        else if (val === 5) spellings[val] = '#3';
      } else if (i === 3) { // 4th
        if (val === 4) spellings[val] = 'b4';
        else if (val === 5) spellings[val] = '4';
        else if (val === 6) spellings[val] = '#4';
      } else if (i === 4) { // 5th
        if (val === 6) spellings[val] = 'b5';
        else if (val === 7) spellings[val] = '5';
        else if (val === 8) spellings[val] = '#5';
      } else if (i === 5) { // 6th
        if (val === 8) spellings[val] = 'b6';
        else if (val === 9) spellings[val] = '6';
        else if (val === 10) spellings[val] = '#6';
      } else if (i === 6) { // 7th
        if (val === 9) spellings[val] = 'bb7';
        else if (val === 10) spellings[val] = 'b7';
        else if (val === 11) spellings[val] = '7';
      }
    }
  }
  return spellings;
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_MIDIS = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

export function getNoteSpelling(rootIndex: number, pitchClass: number, interval: number, degreeString: string): string {
  // Determine root letter
  const rootNoteName = ROOT_NOTES[(rootIndex + pitchClass) % 12];
  const rootLetter = rootNoteName.charAt(0);
  const rootLetterIndex = LETTERS.indexOf(rootLetter);
  
  // Determine target letter based on degree
  let degreeOffset = 0;
  if (degreeString.includes('2')) degreeOffset = 1;
  else if (degreeString.includes('3')) degreeOffset = 2;
  else if (degreeString.includes('4')) degreeOffset = 3;
  else if (degreeString.includes('5')) degreeOffset = 4;
  else if (degreeString.includes('6')) degreeOffset = 5;
  else if (degreeString.includes('7')) degreeOffset = 6;
  
  const targetLetter = LETTERS[(rootLetterIndex + degreeOffset) % 7];
  const targetBaseMidi = LETTER_MIDIS[targetLetter as keyof typeof LETTER_MIDIS];
  
  // Calculate sharp/flat needed
  const actualMidi = (rootIndex + pitchClass + interval) % 12;
  
  let diff = (actualMidi - targetBaseMidi) % 12;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  
  if (diff === 0) return targetLetter;
  if (diff === 1) return targetLetter + '#';
  if (diff === 2) return targetLetter + '##'; // double sharp
  if (diff === -1) return targetLetter + 'b';
  if (diff === -2) return targetLetter + 'bb'; // double flat
  
  // fallback if something goes wildly wrong
  return ROOT_NOTES[actualMidi];
}

export const CHORD_INTERVALS: Record<string, number[]> = {
  'maj7': [0, 4, 7, 11],
  'm7': [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  'm7b5': [0, 3, 6, 10],
  'dim7': [0, 3, 6, 9],
  'mmaj7': [0, 3, 7, 11],
  'maj7#5': [0, 4, 8, 11],
  '7#5': [0, 4, 8, 10],
  'maj': [0, 4, 7],
  'm': [0, 3, 7],
  'dim': [0, 3, 6],
  'aug': [0, 4, 8],
  'sus2': [0, 2, 7],
  'sus4': [0, 5, 7],
  '7sus2': [0, 2, 7, 10],
  '7sus4': [0, 5, 7, 10]
};

export interface ModeInfo {
  parent: string;
  name: string;
}

export type ModeMap = Record<number, Record<string, ModeInfo[]>>;

export function generateModalMap(): ModeMap {
  const map: ModeMap = {};
  for (let i = 0; i < 12; i++) map[i] = {};

  for (const [parent, parentIntervals] of Object.entries(SCALES)) {
    for (let m = 0; m < 7; m++) {
      const modeName = MODE_NAMES[parent][m];
      const modeIntervals = [];
      for (let i = 0; i < 7; i++) {
        modeIntervals.push((parentIntervals[(m + i) % 7] - parentIntervals[m] + 12) % 12);
      }

      for (let i = 0; i < 7; i++) {
        const root = modeIntervals[i];
        const second = modeIntervals[(i + 1) % 7];
        const third = modeIntervals[(i + 2) % 7];
        const fourth = modeIntervals[(i + 3) % 7];
        const fifth = modeIntervals[(i + 4) % 7];
        const seventh = modeIntervals[(i + 6) % 7];

        const chordIntervals7th = [0, (third - root + 12) % 12, (fifth - root + 12) % 12, (seventh - root + 12) % 12];
        const chordIntervalsTriad = [0, (third - root + 12) % 12, (fifth - root + 12) % 12];
        const chordIntervalsSus2 = [0, (second - root + 12) % 12, (fifth - root + 12) % 12];
        const chordIntervalsSus4 = [0, (fourth - root + 12) % 12, (fifth - root + 12) % 12];
        const chordIntervals7Sus2 = [0, (second - root + 12) % 12, (fifth - root + 12) % 12, (seventh - root + 12) % 12];
        const chordIntervals7Sus4 = [0, (fourth - root + 12) % 12, (fifth - root + 12) % 12, (seventh - root + 12) % 12];
        
        for (const cInts of [chordIntervals7th, chordIntervalsTriad, chordIntervalsSus2, chordIntervalsSus4, chordIntervals7Sus2, chordIntervals7Sus4]) {
          let quality = '';
          for (const [q, ints] of Object.entries(CHORD_INTERVALS)) {
            if (ints.length === cInts.length && ints.every((val, idx) => val === cInts[idx])) {
              quality = q;
              break;
            }
          }
    
          if (quality) {
            if (!map[root][quality]) {
              map[root][quality] = [];
            }
            if (!map[root][quality].some(mObj => mObj.name === modeName)) {
              map[root][quality].push({ parent, name: modeName });
            }
          }
        }
      }
    }
  }
  return map;
}

export function getChordScaleName(sourceModeName: string, parentScaleName: string, chordRootInterval: number): string {
  const parentIntervals = SCALES[parentScaleName];
  if (!parentIntervals) return sourceModeName;
  
  const sourceModeIndex = MODE_NAMES[parentScaleName].indexOf(sourceModeName);
  if (sourceModeIndex === -1) return sourceModeName;
  
  const sourceModeInterval = parentIntervals[sourceModeIndex];
  const chordRootRelativeToParent = (sourceModeInterval + chordRootInterval) % 12;
  
  let chordScaleIndex = -1;
  for (let i = 0; i < parentIntervals.length; i++) {
    if (parentIntervals[i] === chordRootRelativeToParent) {
      chordScaleIndex = i;
      break;
    }
  }
  
  if (chordScaleIndex !== -1) {
    return MODE_NAMES[parentScaleName][chordScaleIndex];
  }
  
  return sourceModeName;
}

export function getChordRootName(rootIndex: number, pitchClass: number) {
  const noteIndex = (rootIndex + pitchClass) % 12;
  return ROOT_NOTES[noteIndex];
}

export function getDefaultQuality(pc: number, map: ModeMap) {
  const preferred = DEFAULT_QUALITIES[pc];
  if (map[pc] && map[pc][preferred]) return preferred;
  if (map[pc] && Object.keys(map[pc]).length > 0) {
    return Object.keys(map[pc])[0];
  }
  return 'maj7'; // fallback
}

export function getStandardChordName(midis: number[], chordRootMidi: number): { base: string, ext: string } {
  if (!midis || midis.length === 0) return { base: "", ext: "" };
  const rootPC = chordRootMidi % 12;
  const pcs = Array.from(new Set(midis.map(m => (m - rootPC + 12) % 12))).sort((a,b) => a-b);
  
  const has3 = pcs.includes(4);
  const hasm3 = pcs.includes(3);
  const has5 = pcs.includes(7);
  const hasb5 = pcs.includes(6);
  const hasAug5 = pcs.includes(8);
  const has7 = pcs.includes(10);
  const hasMaj7 = pcs.includes(11);
  const hasDim7 = pcs.includes(9) && hasm3 && hasb5 && !has5;

  const has2 = pcs.includes(2);
  const hasb9 = pcs.includes(1);
  const hasSharp9 = pcs.includes(3) && has3;
  const has4 = pcs.includes(5);
  const hasSharp11 = pcs.includes(6) && has5;
  const has13 = pcs.includes(9) && !hasDim7;
  const hasb13 = pcs.includes(8) && has5;

  let base = "";
  let is7th = false;

  if (has3) {
    if (hasMaj7) {
      if (hasAug5 && !has5) base = "maj7#5";
      else base = "maj7";
      is7th = true;
    } else if (has7) {
      if (hasAug5 && !has5) base = "7#5";
      else if (hasb5 && !has5) base = "7b5";
      else base = "7";
      is7th = true;
    } else {
      if (hasAug5 && !has5) base = "aug";
      else if (hasb5 && !has5) base = "b5";
      else base = "maj";
    }
  } else if (hasm3 && !hasSharp9) {
    if (hasMaj7) {
      base = "mmaj7";
      is7th = true;
    } else if (has7) {
      if (hasb5 && !has5) base = "m7b5";
      else base = "m7";
      is7th = true;
    } else if (hasDim7 && hasb5) {
      base = "dim7";
      is7th = true;
    } else {
      if (hasb5 && !has5) base = "dim";
      else base = "m";
    }
  } else {
    if (has7) {
      if (has4) base = "7sus4";
      else if (has2) base = "7sus2";
      else base = "7(no3)";
      is7th = true;
    } else if (hasMaj7) {
      if (has4) base = "maj7sus4";
      else if (has2) base = "maj7sus2";
      else base = "maj7(no3)";
      is7th = true;
    } else {
      if (has4) base = "sus4";
      else if (has2) base = "sus2";
      else if (has5) base = "5";
      else base = "maj";
    }
  }

  let ext = "";
  if (is7th) {
    let maxExt = 7;
    if (has13) maxExt = 13;
    else if (has4 && !base.includes("sus")) maxExt = 11;
    else if (has2 && !base.includes("sus")) maxExt = 9;

    if (maxExt === 13) base = base.replace("7", "13");
    else if (maxExt === 11) base = base.replace("7", "11");
    else if (maxExt === 9) base = base.replace("7", "9");

    let alts = [];
    if (hasb9) alts.push("b9");
    if (hasSharp9) alts.push("#9");
    if (maxExt < 11 && has4 && !base.includes("sus") && base !== "m11") alts.push("add11");
    if (hasSharp11) alts.push("#11");
    if (hasb13) alts.push("b13");
    if (maxExt < 13 && has13 && !["maj13", "13", "m13"].includes(base)) alts.push("add13");

    if (alts.length > 0) ext = `(${alts.join(", ")})`;
  } else {
    let adds = [];
    if (hasb9) adds.push("b9");
    if (has2 && !base.includes("sus")) adds.push("9");
    if (hasSharp9) adds.push("#9");
    if (has4 && !base.includes("sus")) adds.push("11");
    if (hasSharp11) adds.push("#11");
    if (hasb13) adds.push("b13");
    if (has13) adds.push("13");

    if (adds.length > 0) ext = `(add ${adds.join(", ")})`;
  }

  if (base === "maj") base = "";

  return { base, ext };
}

export function getVoicingLabel(midis: number[], chordRootMidi: number, chordIntervals: number[]): string {
  if (!midis || midis.length === 0) return "";
  
  const sorted = [...midis].sort((a, b) => a - b);
  const bass = sorted[0];
  
  // Calculate Inversion based on all played pitch classes
  const playedPCs = Array.from(new Set(sorted.map(m => m % 12)));
  const rootPC = chordRootMidi % 12;
  playedPCs.sort((a,b) => ((a - rootPC + 12) % 12) - ((b - rootPC + 12) % 12));
  
  const bassPC = bass % 12;
  const bassIndex = playedPCs.indexOf(bassPC);
  
  let invLabel = "Ext in Bass";
  if (bassIndex === 0) invLabel = "Root Pos";
  else if (bassIndex === 1) invLabel = "1st Inv";
  else if (bassIndex === 2) invLabel = "2nd Inv";
  else if (bassIndex === 3) invLabel = "3rd Inv";
  else if (bassIndex === 4) invLabel = "4th Inv";
  else if (bassIndex === 5) invLabel = "5th Inv";
  else if (bassIndex === 6) invLabel = "6th Inv";

  const numNotes = sorted.length;
  if (numNotes < 3) {
    if (numNotes === 1) return `1-Note • ${invLabel}`;
    if (numNotes === 2) return `Interval • ${invLabel}`;
  }

  // Calculate Drop Voicing (generalized for N notes)
  let dropLabel = "Open";
  const span = sorted[sorted.length - 1] - sorted[0];
  
  if (span <= 14) {
    dropLabel = "Close";
  } else {
    // Try moving bass note up 1 octave
    const bassUp = [...sorted.slice(1), sorted[0] + 12].sort((a, b) => a - b);
    if (bassUp[bassUp.length - 1] - bassUp[0] <= 14) {
      const movedNote = sorted[0] + 12;
      let rank = 1;
      for (let v of bassUp) if (v > movedNote) rank++;
      dropLabel = `Drop ${rank}`;
    } else if (sorted.length >= 4) {
      // Try moving bottom TWO notes up 1 octave
      const twoUp = [...sorted.slice(2), sorted[0] + 12, sorted[1] + 12].sort((a, b) => a - b);
      if (twoUp[twoUp.length - 1] - twoUp[0] <= 14) {
        const m1 = sorted[0] + 12;
        const m2 = sorted[1] + 12;
        let rank1 = 1; for (let v of twoUp) if (v > m1) rank1++;
        let rank2 = 1; for (let v of twoUp) if (v > m2) rank2++;
        dropLabel = `Drop ${Math.min(rank1, rank2)} & ${Math.max(rank1, rank2)}`;
      } else if (sorted.length >= 6) {
        const threeUp = [...sorted.slice(3), sorted[0] + 12, sorted[1] + 12, sorted[2] + 12].sort((a,b) => a - b);
        if (threeUp[threeUp.length - 1] - threeUp[0] <= 14) {
          const m1 = sorted[0] + 12;
          const m2 = sorted[1] + 12;
          const m3 = sorted[2] + 12;
          let rank1 = 1; for(let v of threeUp) if(v>m1) rank1++;
          let rank2 = 1; for(let v of threeUp) if(v>m2) rank2++;
          let rank3 = 1; for(let v of threeUp) if(v>m3) rank3++;
          const ranks = [rank1, rank2, rank3].sort((a,b) => a - b);
          dropLabel = `Drop ${ranks[0]}, ${ranks[1]} & ${ranks[2]}`;
        }
      }
    }
  }

  const prefix = numNotes > 4 ? `${numNotes}-Part ` : "";
  return `${prefix}${dropLabel} • ${invLabel}`;
}
