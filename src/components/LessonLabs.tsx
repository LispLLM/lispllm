import S0Hero from '../sections/S0Hero';
import S1NextChar from '../sections/S1NextChar';
import S2Embeddings from '../sections/S2Embeddings';
import S3Attention from '../sections/S3Attention';
import S4Residual from '../sections/S4Residual';
import S5Temperature from '../sections/S5Temperature';
import S6WholeModel from '../sections/S6WholeModel';
import S7Playground from '../sections/S7Playground';
import S8Scale from '../sections/S8Scale';

export default function LessonLabs({ activeLesson }: { activeLesson: number }) {
  return (
    <div className="h-full overflow-y-auto" data-testid="lesson-output">
      <S0Hero labOnly active={activeLesson === 0} />
      <S1NextChar labOnly active={activeLesson === 1} />
      <S2Embeddings labOnly active={activeLesson === 2} />
      <S3Attention labOnly active={activeLesson === 3} />
      <S4Residual labOnly active={activeLesson === 4} />
      <S5Temperature labOnly active={activeLesson === 5} />
      <S6WholeModel labOnly active={activeLesson === 6} />
      <S7Playground labOnly active={activeLesson === 7} />
      <S8Scale labOnly active={activeLesson === 8} />
    </div>
  );
}
