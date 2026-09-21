interface ScreenHeaderProps {
  readonly title: string
  /** One line: the question this screen answers. Not helper text. */
  readonly question: string
}

export function ScreenHeader({ title, question }: ScreenHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-[28px] leading-[1.2] tracking-[-0.01em]">{title}</h1>
      <p className="text-[14px] text-muted">{question}</p>
    </div>
  )
}
