import type { SliceData } from './TimelineChart';

interface Props {
  slice: SliceData | null;
  index: number | null;
}

export default function SliceDetail({ slice, index }: Props) {
  if (!slice) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <p className="text-gray-500 text-sm italic">Click a bar in the timeline to see slice details</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">
        Slice {index !== null ? index + 1 : ''} — Beat {slice.startBeat}–{slice.endBeat}
      </h3>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Group</span>
          <span className="font-mono text-white">{slice.abstractGroup}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Mulliken</span>
          <span className="font-mono text-white">{slice.mullikenLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Stabilizer Order</span>
          <span className="font-mono text-white">{slice.stabilizerOrder}</span>
        </div>
        {slice.chordName && (
          <div className="flex justify-between">
            <span className="text-gray-400">Chord</span>
            <span className="font-mono text-white">{slice.chordName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
