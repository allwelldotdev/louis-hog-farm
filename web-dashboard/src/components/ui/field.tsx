import { cn } from '@/lib/utils'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('eyebrow block', className)} {...props} />
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-control border border-rule bg-raised px-3 text-sm text-ink',
        'placeholder:text-muted/70 transition-colors hover:border-rule-strong',
        'focus:border-ochre focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

/** A native `select`, styled to match `Input`. Native rather than a custom
 *  listbox because the option lists here are short and the browser's own
 *  control is already keyboard- and screen-reader-correct on every platform. */
export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 rounded-control border border-rule bg-raised px-2.5 text-sm text-ink',
        'transition-colors hover:border-rule-strong',
        'focus:border-ochre focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

/** Label, control and message as one unit, so a form never drifts out of
 *  alignment and the error always sits with the field it belongs to. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-alert" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}
