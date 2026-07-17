export default function AskedQuestion({ value }: { value: string }) {
  return (
    <input
      readOnly
      tabIndex={-1}
      value={value}
      className="w-full cursor-default rounded border border-line bg-surface px-3 py-1.5 text-sm text-ink"
    />
  );
}
