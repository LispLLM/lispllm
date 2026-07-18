import { memo, useRef } from 'react';
import S0Hero from '../sections/S0Hero';
import S1NextChar from '../sections/S1NextChar';
import S2Embeddings from '../sections/S2Embeddings';
import S3Attention from '../sections/S3Attention';
import S4Residual from '../sections/S4Residual';
import S5Temperature from '../sections/S5Temperature';
import S6WholeModel from '../sections/S6WholeModel';
import S7Playground from '../sections/S7Playground';
import S8Scale from '../sections/S8Scale';

const LABS = [
  memo(S0Hero),
  memo(S1NextChar),
  memo(S2Embeddings),
  memo(S3Attention),
  memo(S4Residual),
  memo(S5Temperature),
  memo(S6WholeModel),
  memo(S7Playground),
  memo(S8Scale),
];

export default function LessonLabs({ activeLesson }: { activeLesson: number }) {
  const visited = useRef(new Set<number>());
  visited.current.add(activeLesson);
  return (
    <div className="h-full overflow-y-auto" data-testid="lesson-output">
      {LABS.map((Lab, lesson) =>
        visited.current.has(lesson) ? (
          <Lab key={lesson} labOnly active={activeLesson === lesson} />
        ) : null,
      )}
    </div>
  );
}
