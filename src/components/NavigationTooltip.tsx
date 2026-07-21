export default function NavigationTooltip({
  label,
  testId,
  placement = 'right',
}: {
  label: string;
  testId?: string;
  placement?: 'right' | 'below';
}) {
  const position =
    placement === 'below'
      ? 'left-1/2 top-full mt-2 -translate-x-1/2'
      : 'left-full top-1/2 ml-2 -translate-y-1/2 max-md:bottom-full max-md:left-1/2 max-md:top-auto max-md:mb-2 max-md:ml-0 max-md:-translate-x-1/2 max-md:translate-y-0';

  return (
    <span
      role="tooltip"
      data-testid={testId}
      className={`pointer-events-none invisible absolute z-[110] whitespace-nowrap rounded border border-edge bg-panel px-2 py-1 text-[11px] font-normal normal-case tracking-normal text-paper opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 ${position}`}
    >
      {label}
    </span>
  );
}
