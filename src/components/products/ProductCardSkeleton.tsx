export function ProductCardSkeleton() {
  return (
    <div className="rounded-[18px] overflow-hidden animate-pulse" style={{ backgroundColor: 'var(--white)' }} aria-hidden="true">
      <div className="aspect-square" style={{ backgroundColor: 'var(--cream-dark)' }} />
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 rounded-full w-20" style={{ backgroundColor: 'var(--cream-dark)' }} />
          <div className="h-3 rounded-full w-32" style={{ backgroundColor: 'var(--cream-dark)' }} />
        </div>
        <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--cream-dark)' }} />
      </div>
    </div>
  );
}
