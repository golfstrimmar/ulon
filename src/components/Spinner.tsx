export default function Spinner({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`animate-spin rounded-full border-4 border-neutral-300 border-t-blue-600 ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Загрузка"
    />
  );
}
