import { useMemo } from 'react';
import { getImage, useAppState } from '../store/app-store';

export default function ModelInfo() {
  const { imageVersion, seed, sourceDirty, appliedSource } = useAppState();
  const img = getImage();
  const manifest = img.checkpoint.manifest;
  const values = useMemo(() => {
    void imageVersion;
    return {
      lines: img.program.source.trimEnd().split('\n').length,
      defines: img.program.forms.filter(
        (form) =>
          form.kind === 'list' && form.items[0]?.kind === 'sym' && form.items[0].name === 'define',
      ).length,
    };
  }, [img, imageVersion]);
  const rows = [
    ['parameters', manifest.params.toLocaleString()],
    ['layers', manifest.dims.n_layer],
    ['heads / layer', manifest.dims.n_head],
    ['model width', manifest.dims.d_model],
    ['context', manifest.ctx],
    ['vocabulary', manifest.charset.length],
    ['source lines', values.lines],
    ['defines', values.defines],
    ['seed', seed],
  ];

  return (
    <section className="h-full overflow-y-auto p-4 text-xs" data-testid="model-info">
      <div className="mb-4 rounded border border-edge bg-ink/40 p-3">
        <div className="text-[11px] uppercase tracking-wider text-dim">running image</div>
        <div className="mt-1 text-paper">{sourceDirty ? 'last good source' : 'editor source'}</div>
        <div className="mt-1 truncate text-dim" title={appliedSource.slice(0, 120)}>
          deterministic · offline · int8 checkpoint
        </div>
      </div>
      <dl className="divide-y divide-edge border-y border-edge">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 py-2">
            <dt className="text-dim">{label}</dt>
            <dd className="text-paper">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 text-dim">
        All running-model quantities above come from the checkpoint manifest or active AST.
      </div>
    </section>
  );
}
