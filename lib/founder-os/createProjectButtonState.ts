export function isCreateProjectSubmitDisabled({ pending, clicked }: { pending: boolean; clicked: boolean }) {
  return pending || clicked;
}
