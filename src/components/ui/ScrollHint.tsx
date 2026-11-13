export function ScrollHint() {
  return (
    <div className="flex flex-col items-center gap-3 text-paper">
      <span className="text-legible font-sans text-[0.66rem] font-extrabold uppercase tracking-[0.34em]">Scroll to Explore</span>
      <span aria-hidden className="relative block h-10 w-[2px] overflow-hidden rounded-full bg-paper/35">
        <span className="scroll-hint-line absolute inset-0 bg-brand-orange" />
      </span>
    </div>
  );
}
