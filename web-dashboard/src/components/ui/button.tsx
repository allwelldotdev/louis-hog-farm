import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-control text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ochre text-on-accent hover:bg-ochre/90',
        outline:
          'border border-rule bg-transparent text-ink hover:border-rule-strong hover:bg-raised',
        ghost: 'text-muted hover:bg-raised hover:text-ink',
        danger: 'bg-alert text-ink hover:bg-alert/90',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />
}
