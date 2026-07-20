export const COMMENT_ONLY_SOURCE_UPGRADES = [
  {
    from: '12ph0ts',
    to: 'zx9kim',
    legacyLength: 1979,
  },
] as const;

export function isSafeCommentOnlyUpgrade(
  previousFingerprint: string,
  currentFingerprint: string,
  customBase: boolean,
): boolean {
  return (
    !customBase &&
    COMMENT_ONLY_SOURCE_UPGRADES.some(
      (upgrade) => upgrade.from === previousFingerprint && upgrade.to === currentFingerprint,
    )
  );
}
