import { useEffect, useMemo, useRef, useState } from 'react'
import type { AutomationPlaybackVariablePrompt } from '../../shared/browser'

interface AutomationPlaybackPromptProps {
  isOpen: boolean
  sourcePath: string | null
  variables: AutomationPlaybackVariablePrompt[]
  onSubmit: (values: Record<string, string>) => Promise<void>
  onCancel: () => void
}

export function AutomationPlaybackPrompt({
  isOpen,
  sourcePath,
  variables,
  onSubmit,
  onCancel
}: AutomationPlaybackPromptProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setValues((current) =>
      variables.reduce<Record<string, string>>((acc, variable) => {
        acc[variable.name] = current[variable.name] ?? ''
        return acc
      }, {})
    )
    setErrorMessage('')
  }, [isOpen, variables])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    firstInputRef.current?.focus()
  }, [isOpen])

  const canSubmit = useMemo(
    () => variables.every((variable) => (values[variable.name] ?? '').trim().length > 0),
    [values, variables]
  )

  if (!isOpen) {
    return null
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    if (!canSubmit || isSubmitting) {
      setErrorMessage('All required variables need values before playback can start.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const normalizedValues = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value.trim()])
      )
      await onSubmit(normalizedValues)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Playback could not be started.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="playback-prompt__backdrop" role="presentation" onClick={onCancel}>
      <section
        className="playback-prompt__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Automation playback variables"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="playback-prompt__header">
          <h2>Playback Variables</h2>
          <p>{sourcePath ?? 'Workflow source'}</p>
        </header>

        <form className="playback-prompt__form" onSubmit={(event) => void handleSubmit(event)}>
          {variables.map((variable, index) => (
            <label key={variable.name} className="playback-prompt__field">
              <span>{variable.prompt}</span>
              <input
                ref={index === 0 ? firstInputRef : undefined}
                type={variable.secret ? 'password' : 'text'}
                value={values[variable.name] ?? ''}
                onChange={(event) => {
                  setValues((current) => ({
                    ...current,
                    [variable.name]: event.target.value
                  }))
                }}
                autoComplete={variable.secret ? 'new-password' : 'off'}
                aria-label={variable.prompt}
                required
              />
            </label>
          ))}

          {errorMessage ? <p className="playback-prompt__error">{errorMessage}</p> : null}

          <div className="playback-prompt__actions">
            <button type="button" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Starting...' : 'Start Playback'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default AutomationPlaybackPrompt
