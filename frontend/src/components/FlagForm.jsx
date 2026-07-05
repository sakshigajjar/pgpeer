import { useState, useId } from 'react'


// Presentational reason-picker for flagging content (PG or review).
//
// Interface:
//   reasons  — string[] of allowed reasons (differs per resource type)
//   onSubmit — async (reason) => void; parent does the API call + optimistic update
//   onCancel — () => void; parent hides the form
//
// The parent controls visibility (renders <FlagForm> when its expanded state
// is true) and the "already flagged" post-state. This component just handles
// the reason-picking interaction.
//
// useId() generates a unique radio-group name so multiple <FlagForm>s on
// the same page (one per review + one for the PG) don't share radio state.
function FlagForm({ reasons, onSubmit, onCancel }) {
  const [reason, setReason]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)
  const groupName = useId()

  async function handleSubmit() {
    if (!reason) return
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(reason)
      // Parent will now flip to the "already flagged" state and unmount this.
    } catch (err) {
      setError(err.body?.error || err.message || 'Flag failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 rounded-md border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 p-3">
      <p className="text-xs font-medium text-amber-900 dark:text-amber-200 mb-2">
        Why are you flagging this?
      </p>
      <div className="space-y-1.5 mb-3">
        {reasons.map((r) => (
          <label
            key={r}
            className="flex items-center gap-2 text-sm text-stone-800 dark:text-stone-200 cursor-pointer"
          >
            <input
              type="radio"
              name={groupName}
              value={r}
              checked={reason === r}
              onChange={(e) => setReason(e.target.value)}
              className="accent-rose-600"
            />
            <span className="capitalize">{r}</span>
          </label>
        ))}
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400 mb-2">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!reason || submitting}
          className="text-xs px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md disabled:opacity-50"
        >
          {submitting ? 'Flagging…' : 'Submit flag'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="text-xs px-3 py-1.5 border border-stone-300 dark:border-stone-600 rounded-md text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}


export default FlagForm