import { useShell } from '../../layout/useShell'

/** Solo tests: refleja lo registrado en el subheader vía hooks del shell. */
export function SubheaderActionsDump() {
  const { subHeaderActions } = useShell()
  return <div data-testid="subheader-actions-dump">{subHeaderActions}</div>
}
